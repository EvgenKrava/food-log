import { describe, expect, it } from 'vitest';
import { CreateProductRequestSchema, ProductDraftSchema, ProductSchema } from './product.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const SUB = '3f1c9a2e-8b7d-4c6a-9e5f-1a2b3c4d5e6f';

const valid = {
  name: '  Йогурт персик ',
  brand: 'Галичина',
  barcode: '4820000000013',
  per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
  publish: true,
};

describe('CreateProductRequestSchema', () => {
  it('trims the name', () => {
    expect(CreateProductRequestSchema.parse(valid).name).toBe('Йогурт персик');
  });

  it('rejects a whitespace-only name', () => {
    expect(CreateProductRequestSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects names longer than 120 characters', () => {
    expect(CreateProductRequestSchema.safeParse({ ...valid, name: 'я'.repeat(121) }).success).toBe(
      false,
    );
  });

  it('reports an impossible macro sum under per100g.carbs', () => {
    const r = CreateProductRequestSchema.safeParse({
      ...valid,
      per100g: { kcal: 500, protein: 60, fat: 30, carbs: 20 },
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['per100g', 'carbs']);
  });

  it('accepts a photoKey from a scan upload', () => {
    expect(
      CreateProductRequestSchema.safeParse({ ...valid, photoKey: `scans/${SUB}/${ULID}.jpg` })
        .success,
    ).toBe(true);
  });

  it('rejects a photoKey outside scans/', () => {
    expect(
      CreateProductRequestSchema.safeParse({ ...valid, photoKey: `products/${ULID}.jpg` }).success,
    ).toBe(false);
  });
});

describe('ProductSchema', () => {
  it('parses a public OFF product without owner data', () => {
    const r = ProductSchema.safeParse({
      id: 'off-4820000000013',
      source: 'off',
      status: 'approved',
      isOwn: false,
      name: 'Йогурт',
      per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});

describe('ProductDraftSchema', () => {
  it('allows missing per-100 g values', () => {
    expect(ProductDraftSchema.safeParse({ name: 'Печиво', per100g: { kcal: 450 } }).success).toBe(
      true,
    );
  });
});
