import { z } from 'zod';
import { EanSchema, ScanKeySchema } from './common.ts';
import { ProductDraftSchema } from './product.ts';

export const DraftWarningSchema = z.enum([
  'SERVING_SIZE_REQUIRED',
  'MISSING_VALUES',
  'KCAL_MISMATCH',
  'OUT_OF_RANGE',
]);
export type DraftWarning = z.infer<typeof DraftWarningSchema>;

const amount = z.number().min(0).optional();

// What the model reports as printed on the label (the record_label tool input). The domain
// converts it to per-100 g values; this schema only checks the shape.
export const LabelReadingSchema = z.object({
  readable: z.boolean(),
  name: z.string().optional(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  basis: z.enum(['per100g', 'perServing']),
  servingSizeG: z.number().positive().optional(),
  energyKcal: amount,
  energyKj: amount,
  protein: amount,
  fat: amount,
  carbs: amount,
});
export type LabelReading = z.infer<typeof LabelReadingSchema>;

export const ScanRequestSchema = z.object({ key: ScanKeySchema, barcode: EanSchema.optional() });
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const ScanResponseSchema = z.object({
  draft: ProductDraftSchema,
  warnings: z.array(DraftWarningSchema),
  photoKey: ScanKeySchema,
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;
