import { describe, expect, it } from 'vitest';
import { AttachPhotoRequestSchema, PhotoUploadKeySchema } from './photos.ts';

const SUB = '11111111-1111-1111-1111-111111111111';
const ULID = '01KAB0000000000000000000AA';

describe('PhotoUploadKeySchema', () => {
  it('accepts an upload key', () => {
    expect(PhotoUploadKeySchema.safeParse(`uploads/${SUB}/${ULID}.jpg`).success).toBe(true);
  });

  it.each([
    `photos/${SUB}/${ULID}.jpg`,
    `uploads/${SUB}/../${ULID}.jpg`,
    `uploads/${SUB}/${ULID}.png`,
    `scans/${SUB}/${ULID}.jpg`,
  ])('rejects %s', (key) => {
    expect(PhotoUploadKeySchema.safeParse(key).success).toBe(false);
  });
});

describe('AttachPhotoRequestSchema', () => {
  it('needs a key', () => {
    expect(AttachPhotoRequestSchema.safeParse({}).success).toBe(false);
  });
});
