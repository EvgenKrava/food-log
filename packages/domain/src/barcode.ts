import { BarcodeSchema } from '@foodlog/contracts';

// Accepts what a person or a model might type (spaces, dashes) and returns the canonical barcode,
// or undefined when it is not a valid GTIN. Canonicalization rules live in BarcodeSchema.
export function normalizeBarcode(raw: string): string | undefined {
  const parsed = BarcodeSchema.safeParse(raw.replace(/[\s-]/g, ''));
  return parsed.success ? parsed.data : undefined;
}
