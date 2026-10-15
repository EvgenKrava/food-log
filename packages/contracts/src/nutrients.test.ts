import { describe, expect, it } from 'vitest';
import { ManualTargetsSchema, NutrientsSchema, Per100gSchema, TargetsSchema } from './nutrients.ts';

describe('Per100gSchema', () => {
  it('accepts realistic values', () => {
    expect(Per100gSchema.safeParse({ kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 }).success).toBe(
      true,
    );
  });

  it('tolerates floating-point noise in the macro sum', () => {
    expect(
      Per100gSchema.safeParse({ kcal: 500, protein: 33.3, fat: 33.3, carbs: 33.4 }).success,
    ).toBe(true);
  });

  it('rejects a macro sum above 100 g and reports it on carbs', () => {
    const r = Per100gSchema.safeParse({ kcal: 500, protein: 60, fat: 30, carbs: 10.1 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['carbs']);
  });

  it.each([
    { kcal: 901, protein: 0, fat: 0, carbs: 0 },
    { kcal: 100, protein: 101, fat: 0, carbs: 0 },
    { kcal: -1, protein: 0, fat: 0, carbs: 0 },
  ])('rejects out-of-range %o', (v) => {
    expect(Per100gSchema.safeParse(v).success).toBe(false);
  });
});

describe('NutrientsSchema', () => {
  it('has no upper bound (portion totals can be large)', () => {
    expect(
      NutrientsSchema.safeParse({ kcal: 3500, protein: 250, fat: 120, carbs: 400 }).success,
    ).toBe(true);
  });
});

describe('TargetsSchema', () => {
  it('requires whole numbers', () => {
    expect(
      TargetsSchema.safeParse({ kcal: 2000.5, protein: 100, fat: 60, carbs: 250 }).success,
    ).toBe(false);
  });
});

describe('ManualTargetsSchema', () => {
  it('rejects a manual kcal target below 500', () => {
    expect(
      ManualTargetsSchema.safeParse({ kcal: 400, protein: 100, fat: 60, carbs: 0 }).success,
    ).toBe(false);
  });

  it('accepts a sensible manual target', () => {
    expect(
      ManualTargetsSchema.safeParse({ kcal: 1800, protein: 120, fat: 60, carbs: 195 }).success,
    ).toBe(true);
  });
});
