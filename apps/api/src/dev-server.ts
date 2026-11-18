// Local API for UI work: in-memory data, real Open Food Facts, every caller is one test user.
// Label scans call real Bedrock when AWS credentials are present (AWS_PROFILE=yevhenii).
// Run: node apps/api/src/dev-server.ts (Node ≥ 22.18 strips the types), then `pnpm --filter @foodlog/web dev`.
import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { MemoryRepository } from './memory-repo.ts';
import { BedrockLabelReader } from './label-reader.ts';
import { HttpFoodFacts } from './off.ts';

const app = createApp({
  repo: new MemoryRepository(),
  off: new HttpFoodFacts(),
  clock: () => new Date(),
  historyDays: 365,
  labels: new BedrockLabelReader(process.env.LABEL_MODEL || undefined),
  identify: () => ({
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'dev@localhost',
    // DEV_ADMIN=1 also makes the test user a catalog moderator.
    groups: process.env.DEV_ADMIN === '1' ? ['foodlog-user', 'foodlog-admin'] : ['foodlog-user'],
  }),
});

const port = Number(process.env.PORT ?? 8787);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const response = await app.fetch(
    new Request(`http://localhost:${port}${req.url ?? '/'}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      ...(body && req.method !== 'GET' && req.method !== 'HEAD' ? { body } : {}),
    }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`FoodLog dev API on http://localhost:${port}`));
