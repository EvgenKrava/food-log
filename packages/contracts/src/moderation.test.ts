import { describe, expect, it } from 'vitest';
import { ModerationQueueItemSchema, RejectRequestSchema } from './moderation.ts';

const product = {
  id: '01JA2B3C4D5E6F7G8H9JKMNPQR',
  source: 'user',
  status: 'pending',
  isOwn: false,
  name: 'Сирок глазурований',
  barcode: '4820000000017',
  per100g: { kcal: 413, protein: 8.5, fat: 27.8, carbs: 32 },
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

describe('RejectRequestSchema', () => {
  it('trims and requires at least 3 characters', () => {
    expect(RejectRequestSchema.safeParse({ reason: '  ok ' }).success).toBe(false);
    expect(RejectRequestSchema.parse({ reason: '  Wrong kcal ' }).reason).toBe('Wrong kcal');
  });
});

describe('ModerationQueueItemSchema', () => {
  it('parses a product submission', () => {
    const r = ModerationQueueItemSchema.safeParse({
      type: 'product',
      product,
      isRevision: false,
      kcalMismatch: false,
      photoUrl: null,
      duplicate: null,
    });
    expect(r.success).toBe(true);
  });

  it('rejects a dish entry carrying a product payload', () => {
    const r = ModerationQueueItemSchema.safeParse({
      type: 'dish',
      product,
      isRevision: false,
      kcalMismatch: false,
    });
    expect(r.success).toBe(false);
  });
});
