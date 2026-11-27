import { z } from 'zod';
import {
  GramsSchema,
  IsoDateTimeSchema,
  ModerationStatusSchema,
  ProductIdSchema,
  UlidSchema,
} from './common.ts';
import { NutrientsSchema, Per100gSchema } from './nutrients.ts';

export const DISH_INGREDIENTS_MAX = 50;
const DishNameSchema = z.string().trim().min(1).max(120);
const CookedWeightSchema = z.number().positive().max(20000).optional();

export const DishIngredientInputSchema = z.object({
  productId: ProductIdSchema,
  grams: GramsSchema,
});

export const DishFieldsSchema = z.object({
  name: DishNameSchema,
  ingredients: z.array(DishIngredientInputSchema).min(1).max(DISH_INGREDIENTS_MAX),
  cookedWeightG: CookedWeightSchema,
});

export const CreateDishRequestSchema = DishFieldsSchema.extend({ publish: z.boolean() });
export type CreateDishRequest = z.infer<typeof CreateDishRequestSchema>;

export const UpdateDishRequestSchema = DishFieldsSchema;
export type UpdateDishRequest = z.infer<typeof UpdateDishRequestSchema>;

export const DishIngredientSchema = DishIngredientInputSchema.extend({
  name: z.string(),
  per100g: Per100gSchema,
});
export type DishIngredient = z.infer<typeof DishIngredientSchema>;

export const DishContentSchema = z.object({
  name: DishNameSchema,
  ingredients: z.array(DishIngredientSchema).min(1).max(DISH_INGREDIENTS_MAX),
  cookedWeightG: CookedWeightSchema,
});
export type DishContent = z.infer<typeof DishContentSchema>;

export const DishSchema = DishContentSchema.extend({
  id: UlidSchema,
  totals: NutrientsSchema,
  weightG: z.number().positive(),
  per100g: NutrientsSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  rejectReason: z.string().optional(),
  pendingRevision: DishContentSchema.optional(),
  /** The caller's own photo of this dish, if they added one. */
  photoUrl: z.url().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Dish = z.infer<typeof DishSchema>;
