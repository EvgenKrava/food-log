import { z } from 'zod';
import { BarcodeSchema, ScanKeySchema } from './common.ts';
import { ProductDraftSchema } from './product.ts';
import { UploadContentTypeSchema } from './uploads.ts';

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

export const ScanRequestSchema = z.object({
  key: ScanKeySchema,
  barcode: BarcodeSchema.optional(),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

// The client downsizes the photo and sends it inline (base64), so no upload bucket is needed.
export const SCAN_IMAGE_MAX_BASE64 = 4_000_000;

export const ScanImageRequestSchema = z.object({
  image: z.string().min(100).max(SCAN_IMAGE_MAX_BASE64).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64'),
  mediaType: UploadContentTypeSchema,
  barcode: BarcodeSchema.optional(),
});
export type ScanImageRequest = z.infer<typeof ScanImageRequestSchema>;

export const ScanResponseSchema = z.object({
  draft: ProductDraftSchema,
  warnings: z.array(DraftWarningSchema),
  photoKey: ScanKeySchema.optional(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;
