import { expect } from 'vitest';
import type { Nutrients } from '@foodlog/contracts';

export function expectNutrientsClose(actual: Nutrients, expected: Nutrients, digits = 6): void {
  expect(actual.kcal).toBeCloseTo(expected.kcal, digits);
  expect(actual.protein).toBeCloseTo(expected.protein, digits);
  expect(actual.fat).toBeCloseTo(expected.fat, digits);
  expect(actual.carbs).toBeCloseTo(expected.carbs, digits);
}
