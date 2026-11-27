import { DomainError } from '@foodlog/domain';
import type { PhotoStore } from './ports.ts';

/** In-memory PhotoStore for tests: `uploaded()` stands in for the browser's direct upload. */
export class MemoryPhotoStore implements PhotoStore {
  readonly objects = new Set<string>();

  uploaded(key: string) {
    this.objects.add(key);
  }

  async presignUpload(uid: string, id: string) {
    const key = `uploads/${uid}/${id}.jpg`;
    return { url: 'https://photos.test/', fields: { key }, key };
  }

  async attach(uploadKey: string, uid: string, id: string) {
    if (!this.objects.delete(uploadKey)) throw new DomainError('NOT_FOUND', 'upload not found');
    const key = `photos/${uid}/${id}.jpg`;
    this.objects.add(key);
    return key;
  }

  async remove(key: string) {
    this.objects.delete(key);
  }

  async removeAll(uid: string) {
    for (const k of [...this.objects]) {
      if (k.startsWith(`photos/${uid}/`) || k.startsWith(`uploads/${uid}/`)) this.objects.delete(k);
    }
  }

  url(key: string) {
    return `https://foodlog.test/${key}`;
  }
}
