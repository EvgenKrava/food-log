import { describe, expect, it } from 'vitest';
import { PresignRequestSchema } from './uploads.ts';

describe('PresignRequestSchema', () => {
  it.each(['image/jpeg', 'image/webp'])('accepts %s', (contentType) => {
    expect(PresignRequestSchema.safeParse({ contentType }).success).toBe(true);
  });

  it('rejects other content types', () => {
    expect(PresignRequestSchema.safeParse({ contentType: 'image/png' }).success).toBe(false);
  });
});
