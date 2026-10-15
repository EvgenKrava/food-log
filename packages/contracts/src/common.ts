import { z } from 'zod';

export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

export const IsoDateTimeSchema = z.iso.datetime();

export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a ULID');

// EAN-8, UPC-A (12), EAN-13 and GTIN-14 — digits only; canonicalization lives in the domain.
export const EanSchema = z.string().regex(/^(\d{8}|\d{12,14})$/, 'must be 8 or 12–14 digits');

// GS1 check digit: weights 3,1,3,1… from the rightmost data digit. Catches every single-digit
// misread.
export function hasValidGtinCheckDigit(digits: string): boolean {
  const data = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const digit = Number(data[data.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

// A real product barcode in canonical form: UPC-A (12 digits) gains a leading 0 and a GTIN-14 with
// indicator digit 0 drops it, giving the EAN-13 Open Food Facts stores; EAN-8 and other GTIN-14
// codes stay as they are. Every request that carries a barcode parses through this schema.
export const BarcodeSchema = EanSchema.refine(hasValidGtinCheckDigit, {
  message: 'invalid GTIN check digit',
}).transform((digits) => {
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1);
  return digits;
});

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
