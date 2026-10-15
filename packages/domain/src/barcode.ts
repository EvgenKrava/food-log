import { EanSchema } from '@foodlog/contracts';

// UPC-A (12 digits) and its EAN-13 form with a leading 0 identify the same product; Open Food
// Facts stores the 13-digit form, so every lookup and write goes through this canonical form.
export function normalizeBarcode(raw: string): string | undefined {
  const digits = raw.replace(/[\s-]/g, '');
  if (!EanSchema.safeParse(digits).success) return undefined;
  return digits.length === 12 ? `0${digits}` : digits;
}
