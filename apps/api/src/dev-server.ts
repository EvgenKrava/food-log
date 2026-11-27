// Local API for UI work: in-memory data, real Open Food Facts, every caller is one test user.
// Label scans call real Bedrock when AWS credentials are present (AWS_PROFILE=yevhenii).
// Run: node apps/api/src/dev-server.ts (Node ≥ 22.18 strips the types), then `pnpm --filter @foodlog/web dev`.
import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { MemoryRepository } from './memory-repo.ts';
import { BedrockLabelReader } from './label-reader.ts';
import { HttpFoodFacts } from './off.ts';
import { MemoryPhotoStore } from './memory-photos.ts';

const port = Number(process.env.PORT ?? 8787);
const origin = `http://localhost:${port}`;

// Photos stay in memory too: the browser "uploads" to POST /__uploads, and GET /photos/* serves them.
class DevPhotoStore extends MemoryPhotoStore {
  readonly bytes = new Map<string, Buffer>();
  override async presignUpload(uid: string, id: string) {
    const key = `uploads/${uid}/${id}.jpg`;
    return { url: `${origin}/__uploads`, fields: { key }, key };
  }
  override async attach(uploadKey: string, uid: string, id: string) {
    const key = await super.attach(uploadKey, uid, id);
    this.bytes.set(key, this.bytes.get(uploadKey) ?? Buffer.alloc(0));
    this.bytes.delete(uploadKey);
    return key;
  }
  override url(key: string) {
    return `${origin}/${key}`;
  }
}
const photos = new DevPhotoStore();

const app = createApp({
  photos,
  repo: new MemoryRepository(),
  off: new HttpFoodFacts(),
  clock: () => new Date(),
  labels: new BedrockLabelReader(process.env.LABEL_MODEL || undefined),
  identify: () => ({
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'dev@localhost',
    // DEV_ADMIN=1 also makes the test user a catalog moderator.
    // DEV_PLUS=1 puts the test user on Plus.
    groups: [
      'foodlog-user',
      ...(process.env.DEV_ADMIN === '1' ? ['foodlog-admin'] : []),
      ...(process.env.DEV_PLUS === '1' ? ['plus'] : []),
    ],
  }),
});

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  if (req.url === '/__uploads') {
    if (req.method === 'POST' && body) {
      const form = await new Request(`${origin}/__uploads`, {
        method: 'POST',
        headers: req.headers as Record<string, string>,
        body,
      }).formData();
      const key = String(form.get('key'));
      const file = form.get('file');
      if (file instanceof Blob) {
        photos.bytes.set(key, Buffer.from(await file.arrayBuffer()));
        photos.uploaded(key);
      }
    }
    res.writeHead(204, cors).end();
    return;
  }
  const stored = req.url?.startsWith('/photos/') ? photos.bytes.get(req.url.slice(1)) : undefined;
  if (stored) {
    res.writeHead(200, { 'content-type': 'image/jpeg' }).end(stored);
    return;
  }
  const response = await app.fetch(
    new Request(`http://localhost:${port}${req.url ?? '/'}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      ...(body && req.method !== 'GET' && req.method !== 'HEAD' ? { body } : {}),
    }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`FoodLog dev API on ${origin}`));
