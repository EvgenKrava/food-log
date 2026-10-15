import type { Meal, Nutrients } from '@foodlog/contracts';
import { DomainError } from './errors.ts';

export function zeroNutrients(): Nutrients {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
}

function mapNutrients(n: Nutrients, f: (value: number) => number): Nutrients {
  return { kcal: f(n.kcal), protein: f(n.protein), fat: f(n.fat), carbs: f(n.carbs) };
}

export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  return mapNutrients(per100g, (value) => (value * grams) / 100);
}

export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      fat: acc.fat + n.fat,
      carbs: acc.carbs + n.carbs,
    }),
    zeroNutrients(),
  );
}

export function per100gFromTotals(totals: Nutrients, weightG: number): Nutrients {
  if (!(weightG > 0)) {
    throw new DomainError('VALIDATION', 'Weight must be greater than 0 g');
  }
  return mapNutrients(totals, (value) => (value * 100) / weightG);
}

export const KCAL_MISMATCH_TOLERANCE = 0.2;

export function kcalFromMacros(n: Pick<Nutrients, 'protein' | 'fat' | 'carbs'>): number {
  return 4 * n.protein + 9 * n.fat + 4 * n.carbs;
}

// Flags values whose stated kcal disagrees with 4/9/4 by more than 20% — typical of a misread label.
export function hasKcalMismatch(n: Nutrients): boolean {
  return Math.abs(n.kcal - kcalFromMacros(n)) / Math.max(n.kcal, 1) > KCAL_MISMATCH_TOLERANCE;
}

export type DaySummary = { totals: Nutrients; byMeal: Record<Meal, Nutrients> };

export function summarizeDay(entries: readonly { meal: Meal; nutrients: Nutrients }[]): DaySummary {
  const totalFor = (meal: Meal): Nutrients =>
    sumNutrients(entries.filter((e) => e.meal === meal).map((e) => e.nutrients));
  return {
    totals: sumNutrients(entries.map((e) => e.nutrients)),
    byMeal: {
      breakfast: totalFor('breakfast'),
      lunch: totalFor('lunch'),
      dinner: totalFor('dinner'),
      snack: totalFor('snack'),
    },
  };
}
