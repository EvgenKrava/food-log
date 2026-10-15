import { describe, expect, it } from 'vitest';
import { AGE_MAX, AGE_MIN, PutProfileRequestSchema } from './profile.ts';
import { PutWeightRequestSchema } from './weight.ts';

const year = new Date().getUTCFullYear();
const body = {
  sex: 'female',
  birthYear: year - 30,
  heightCm: 165,
  activity: 'light',
  goal: 'lose',
  locale: 'uk',
  targetsManual: false,
};

describe('PutProfileRequestSchema', () => {
  it('accepts calculated targets without explicit targets', () => {
    expect(PutProfileRequestSchema.safeParse(body).success).toBe(true);
  });

  it('requires targets when targetsManual is true', () => {
    const r = PutProfileRequestSchema.safeParse({ ...body, targetsManual: true });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['targets']);
  });

  it('rejects a manual kcal target below 500', () => {
    const r = PutProfileRequestSchema.safeParse({
      ...body,
      targetsManual: true,
      targets: { kcal: 400, protein: 80, fat: 20, carbs: 0 },
    });
    expect(r.success).toBe(false);
  });

  it.each([AGE_MIN - 1, AGE_MAX + 1])('rejects age %i', (age) => {
    expect(PutProfileRequestSchema.safeParse({ ...body, birthYear: year - age }).success).toBe(
      false,
    );
  });

  it.each([AGE_MIN, AGE_MAX])('accepts age %i', (age) => {
    expect(PutProfileRequestSchema.safeParse({ ...body, birthYear: year - age }).success).toBe(
      true,
    );
  });
});

describe('PutWeightRequestSchema', () => {
  it.each([19.9, 400.1])('rejects %d kg', (kg) => {
    expect(PutWeightRequestSchema.safeParse({ kg }).success).toBe(false);
  });

  it('accepts 72.4 kg', () => {
    expect(PutWeightRequestSchema.safeParse({ kg: 72.4 }).success).toBe(true);
  });
});
