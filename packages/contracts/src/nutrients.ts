import { z } from 'zod';

export const NutrientsSchema = z.object({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carbs: z.number().min(0),
});
export type Nutrients = z.infer<typeof NutrientsSchema>;

// Floating-point slack so 33.3 + 33.3 + 33.4 is not rejected.
const MACRO_SUM_EPSILON = 1e-6;
const macroPer100g = z.number().min(0).max(100);

export const Per100gSchema = z
  .object({
    kcal: z.number().min(0).max(900),
    protein: macroPer100g,
    fat: macroPer100g,
    carbs: macroPer100g,
  })
  .refine((n) => n.protein + n.fat + n.carbs <= 100 + MACRO_SUM_EPSILON, {
    message: 'protein + fat + carbs must not exceed 100 g per 100 g',
    path: ['carbs'],
  });
export type Per100g = z.infer<typeof Per100gSchema>;

export const TargetsSchema = z.object({
  kcal: z.number().int().min(0).max(10000),
  protein: z.number().int().min(0).max(1000),
  fat: z.number().int().min(0).max(1000),
  carbs: z.number().int().min(0).max(2000),
});
export type Targets = z.infer<typeof TargetsSchema>;

export const ManualTargetsSchema = TargetsSchema.extend({
  kcal: z.number().int().min(500).max(10000),
});
