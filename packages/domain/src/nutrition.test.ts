import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.ts';
import {
  hasKcalMismatch,
  kcalFromMacros,
  per100gFromTotals,
  scaleNutrients,
  sumNutrients,
  summarizeDay,
  zeroNutrients,
} from './nutrition.ts';
import { expectNutrientsClose } from './testing/nutrients.ts';

const apple = { kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 };

describe('scaleNutrients', () => {
  it('scales per-100 g values to a portion', () => {
    expectNutrientsClose(scaleNutrients(apple, 150), {
      kcal: 78,
      protein: 0.45,
      fat: 0.3,
      carbs: 21,
    });
  });
});

describe('sumNutrients', () => {
  it('returns zeros for no items', () => {
    expect(sumNutrients([])).toEqual(zeroNutrients());
  });

  it('adds field by field', () => {
    expectNutrientsClose(sumNutrients([apple, { kcal: 100, protein: 10, fat: 5, carbs: 1 }]), {
      kcal: 152,
      protein: 10.3,
      fat: 5.2,
      carbs: 15,
    });
  });
});

describe('per100gFromTotals', () => {
  it('converts totals of a 250 g portion back to per 100 g', () => {
    expectNutrientsClose(per100gFromTotals({ kcal: 500, protein: 25, fat: 10, carbs: 75 }, 250), {
      kcal: 200,
      protein: 10,
      fat: 4,
      carbs: 30,
    });
  });

  it('rejects a non-positive weight', () => {
    expect(() => per100gFromTotals(apple, 0)).toThrow(DomainError);
  });
});

describe('kcalFromMacros', () => {
  it('uses 4/9/4 kcal per gram', () => {
    expect(kcalFromMacros(apple)).toBeCloseTo(59, 6);
  });
});

describe('hasKcalMismatch', () => {
  it.each([
    ['an apple', apple, false],
    ['a misread kcal (520 instead of 52)', { ...apple, kcal: 520 }, true],
    ['all zeros', zeroNutrients(), false],
    ['zero kcal with protein', { kcal: 0, protein: 10, fat: 0, carbs: 0 }, true],
    ['exactly 20% off', { kcal: 100, protein: 30, fat: 0, carbs: 0 }, false],
    ['just over 20% off', { kcal: 100, protein: 30.25, fat: 0, carbs: 0 }, true],
  ])('%s → %s', (_label, nutrients, expected) => {
    expect(hasKcalMismatch(nutrients)).toBe(expected);
  });
});

describe('summarizeDay', () => {
  it('totals the day and each meal, with zeros for empty meals', () => {
    const summary = summarizeDay([
      { meal: 'breakfast', nutrients: { kcal: 300, protein: 20, fat: 10, carbs: 30 } },
      { meal: 'breakfast', nutrients: { kcal: 100, protein: 5, fat: 2, carbs: 15 } },
      { meal: 'snack', nutrients: apple },
    ]);
    expectNutrientsClose(summary.byMeal.breakfast, { kcal: 400, protein: 25, fat: 12, carbs: 45 });
    expect(summary.byMeal.lunch).toEqual(zeroNutrients());
    expect(summary.byMeal.dinner).toEqual(zeroNutrients());
    expectNutrientsClose(summary.byMeal.snack, apple);
    expectNutrientsClose(summary.totals, { kcal: 452, protein: 25.3, fat: 12.2, carbs: 59 });
  });
});
