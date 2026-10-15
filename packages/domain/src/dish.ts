import type { Nutrients } from '@foodlog/contracts';
import { DomainError } from './errors.ts';
import { per100gFromTotals, scaleNutrients, sumNutrients } from './nutrition.ts';

export type DishIngredientValues = { grams: number; per100g: Nutrients };
export type DishComputation = { totals: Nutrients; weightG: number; per100g: Nutrients };

export function computeDish(
  ingredients: readonly DishIngredientValues[],
  cookedWeightG?: number,
): DishComputation {
  if (ingredients.length === 0) {
    throw new DomainError('VALIDATION', 'A dish needs at least one ingredient');
  }
  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.per100g, i.grams)));
  const weightG = cookedWeightG ?? ingredients.reduce((sum, i) => sum + i.grams, 0);
  return { totals, weightG, per100g: per100gFromTotals(totals, weightG) };
}
