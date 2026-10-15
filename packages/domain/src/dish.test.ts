import { describe, expect, it } from 'vitest';
import { computeDish } from './dish.ts';
import { DomainError } from './errors.ts';
import { expectNutrientsClose } from './testing/nutrients.ts';

const buckwheat = { grams: 100, per100g: { kcal: 343, protein: 13.3, fat: 3.4, carbs: 68 } };
const butter = { grams: 10, per100g: { kcal: 748, protein: 0.5, fat: 82.5, carbs: 0.8 } };
const totals = { kcal: 417.8, protein: 13.35, fat: 11.65, carbs: 68.08 };

describe('computeDish', () => {
  it('sums ingredients and uses their total weight by default', () => {
    const dish = computeDish([buckwheat, butter]);
    expectNutrientsClose(dish.totals, totals);
    expect(dish.weightG).toBe(110);
    expectNutrientsClose(dish.per100g, {
      kcal: (417.8 * 100) / 110,
      protein: (13.35 * 100) / 110,
      fat: (11.65 * 100) / 110,
      carbs: (68.08 * 100) / 110,
    });
  });

  it('uses the cooked weight for per-100 g values when given', () => {
    const dish = computeDish([buckwheat, butter], 250);
    expectNutrientsClose(dish.totals, totals);
    expect(dish.weightG).toBe(250);
    expectNutrientsClose(dish.per100g, { kcal: 167.12, protein: 5.34, fat: 4.66, carbs: 27.232 });
  });

  it('rejects a dish without ingredients', () => {
    expect(() => computeDish([])).toThrow(DomainError);
  });

  it('rejects a zero cooked weight', () => {
    expect(() => computeDish([buckwheat], 0)).toThrow(DomainError);
  });
});
