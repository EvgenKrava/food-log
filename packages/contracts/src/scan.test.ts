import { describe, expect, it } from 'vitest';
import { LabelReadingSchema, ScanRequestSchema, ScanResponseSchema } from './scan.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const SUB = '3f1c9a2e-8b7d-4c6a-9e5f-1a2b3c4d5e6f';
const key = `scans/${SUB}/${ULID}.jpg`;

describe('LabelReadingSchema', () => {
  it('accepts an unreadable reading with only the required fields', () => {
    expect(LabelReadingSchema.safeParse({ readable: false, basis: 'per100g' }).success).toBe(true);
  });

  it('rejects negative values and unknown bases', () => {
    expect(
      LabelReadingSchema.safeParse({ readable: true, basis: 'per100g', protein: -1 }).success,
    ).toBe(false);
    expect(LabelReadingSchema.safeParse({ readable: true, basis: 'perPack' }).success).toBe(false);
  });
});

describe('ScanRequestSchema', () => {
  it('accepts a scan key with an optional barcode', () => {
    expect(ScanRequestSchema.safeParse({ key, barcode: '4820000000013' }).success).toBe(true);
  });

  it('rejects path traversal in the key', () => {
    expect(ScanRequestSchema.safeParse({ key: `scans/../${ULID}.jpg` }).success).toBe(false);
  });
});

describe('ScanResponseSchema', () => {
  it('parses a partial draft with warnings', () => {
    const r = ScanResponseSchema.safeParse({
      draft: { name: 'Печиво', per100g: {} },
      warnings: ['SERVING_SIZE_REQUIRED'],
      photoKey: key,
    });
    expect(r.success).toBe(true);
  });
});
