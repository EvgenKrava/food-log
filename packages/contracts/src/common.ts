import { z } from 'zod';

export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

export const IsoDateTimeSchema = z.iso.datetime();

export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID');

// EAN-8, UPC-A (12), EAN-13 and GTIN-14 — digits only; canonicalization lives in the domain.
export const EanSchema = z.string().regex(/^(\d{8}|\d{12,14})$/, 'must be 8 or 12–14 digits');

export const OffProductIdSchema = z.string().regex(/^off-(\d{8}|\d{12,14})$/);
export const ProductIdSchema = z.union([UlidSchema, OffProductIdSchema]);

export const GRAMS_MAX = 5000;
export const GramsSchema = z.number().positive().max(GRAMS_MAX);

export const MealSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type Meal = z.infer<typeof MealSchema>;
export const MEALS = MealSchema.options;

export const ItemTypeSchema = z.enum(['product', 'dish']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('product'), id: ProductIdSchema }),
  z.object({ type: z.literal('dish'), id: UlidSchema }),
]);
export type ItemRef = z.infer<typeof ItemRefSchema>;

export const ModerationStatusSchema = z.enum([
  'private',
  'pending',
  'approved',
  'rejected',
  'hidden',
]);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

export const ProductSourceSchema = z.enum(['off', 'user']);
export type ProductSource = z.infer<typeof ProductSourceSchema>;

// scans/<cognito sub>/<ulid>.jpg — the scan Lambda additionally checks the sub matches the caller.
export const ScanKeySchema = z
  .string()
  .regex(/^scans\/[0-9a-f-]{36}\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/, 'must be a scan upload key');

const DAY_MS = 86_400_000;

export function daysInclusive(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

export function dateRangeQuerySchema(maxDays: number) {
  return z
    .object({ from: IsoDateSchema, to: IsoDateSchema })
    .refine((r) => r.from <= r.to && daysInclusive(r.from, r.to) <= maxDays, {
      message: `from must not be after to, and the range must be at most ${maxDays} days`,
      path: ['to'],
    });
}
