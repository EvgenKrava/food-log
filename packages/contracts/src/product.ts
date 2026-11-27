import { z } from 'zod';
import {
  BarcodeSchema,
  GRAMS_MAX,
  IsoDateTimeSchema,
  ModerationStatusSchema,
  ProductIdSchema,
  ProductSourceSchema,
  ScanKeySchema,
} from './common.ts';
import { Per100gSchema } from './nutrients.ts';

export const ProductFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().min(1).max(80).optional(),
  barcode: BarcodeSchema.optional(),
  servingSizeG: z.number().positive().max(GRAMS_MAX).optional(),
  per100g: Per100gSchema,
});
export type ProductFields = z.infer<typeof ProductFieldsSchema>;

export const CreateProductRequestSchema = ProductFieldsSchema.extend({
  publish: z.boolean(),
  photoKey: ScanKeySchema.optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = ProductFieldsSchema;
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const ProductSchema = ProductFieldsSchema.extend({
  id: ProductIdSchema,
  source: ProductSourceSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  rejectReason: z.string().optional(),
  pendingRevision: ProductFieldsSchema.optional(),
  /** The caller's own photo of this product, if they added one. */
  photoUrl: z.url().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Product = z.infer<typeof ProductSchema>;

const optionalAmount = z.number().min(0).optional();

export const ProductDraftSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  barcode: BarcodeSchema.optional(),
  servingSizeG: z.number().positive().optional(),
  per100g: z.object({
    kcal: optionalAmount,
    protein: optionalAmount,
    fat: optionalAmount,
    carbs: optionalAmount,
  }),
});
export type ProductDraft = z.infer<typeof ProductDraftSchema>;

export const DuplicateBarcodeDetailsSchema = z.object({ product: ProductSchema });
