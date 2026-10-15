import { describe, expect, it } from 'vitest';
import { CreateDishRequestSchema, DISH_INGREDIENTS_MAX } from './dish.ts';

const ingredient = { productId: 'off-4820000000013', grams: 100 };
const valid = { name: 'Гречка з маслом', ingredients: [ingredient], publish: false };

describe('CreateDishRequestSchema', () => {
  it('accepts a single-ingredient dish without cooked weight', () => {
    expect(CreateDishRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a cooked weight', () => {
    expect(CreateDishRequestSchema.safeParse({ ...valid, cookedWeightG: 250 }).success).toBe(true);
  });

  it('rejects a dish without ingredients', () => {
    expect(CreateDishRequestSchema.safeParse({ ...valid, ingredients: [] }).success).toBe(false);
  });

  it(`rejects more than ${DISH_INGREDIENTS_MAX} ingredients`, () => {
    const ingredients = Array.from({ length: DISH_INGREDIENTS_MAX + 1 }, () => ingredient);
    expect(CreateDishRequestSchema.safeParse({ ...valid, ingredients }).success).toBe(false);
  });

  it('rejects zero grams and zero cooked weight', () => {
    expect(
      CreateDishRequestSchema.safeParse({ ...valid, ingredients: [{ ...ingredient, grams: 0 }] })
        .success,
    ).toBe(false);
    expect(CreateDishRequestSchema.safeParse({ ...valid, cookedWeightG: 0 }).success).toBe(false);
  });
});
