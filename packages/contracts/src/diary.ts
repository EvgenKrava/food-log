import { z } from 'zod';
import {
  GramsSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  ItemRefSchema,
  MealSchema,
  UlidSchema,
} from './common.ts';
import { NutrientsSchema, TargetsSchema } from './nutrients.ts';

export const CreateDiaryEntryRequestSchema = z.object({
  meal: MealSchema,
  item: ItemRefSchema,
  grams: GramsSchema,
});
export type CreateDiaryEntryRequest = z.infer<typeof CreateDiaryEntryRequestSchema>;

export const UpdateDiaryEntryRequestSchema = z
  .object({ meal: MealSchema.optional(), grams: GramsSchema.optional() })
  .refine((v) => v.meal !== undefined || v.grams !== undefined, {
    message: 'meal or grams is required',
  });
export type UpdateDiaryEntryRequest = z.infer<typeof UpdateDiaryEntryRequestSchema>;

export const DiaryEntrySchema = z.object({
  id: UlidSchema,
  date: IsoDateSchema,
  meal: MealSchema,
  item: ItemRefSchema,
  name: z.string(),
  per100g: NutrientsSchema,
  grams: GramsSchema,
  nutrients: NutrientsSchema,
  createdAt: IsoDateTimeSchema,
});
export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

export const MealTotalsSchema = z.object({
  breakfast: NutrientsSchema,
  lunch: NutrientsSchema,
  dinner: NutrientsSchema,
  snack: NutrientsSchema,
});

export const DiaryDaySchema = z.object({
  date: IsoDateSchema,
  entries: z.array(DiaryEntrySchema),
  totals: NutrientsSchema,
  byMeal: MealTotalsSchema,
  targets: TargetsSchema.nullable(),
});
export type DiaryDay = z.infer<typeof DiaryDaySchema>;
