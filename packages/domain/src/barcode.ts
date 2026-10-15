import { EanSchema } from '@foodlog/contracts';

// GS1 check digit: weights 3,1,3,1… from the rightmost data digit. Catches every single-digit
// misread, which matters for barcodes the vision model reads off a label.
function hasValidCheckDigit(digits: string): boolean {
  const data = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const digit = Number(data[data.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

// UPC-A (12 digits) and its EAN-13 form with a leading 0 identify the same product; Open Food
// Facts stores the 13-digit form, so every lookup and write goes through this canonical form.
export function normalizeBarcode(raw: string): string | undefined {
  const digits = raw.replace(/[\s-]/g, '');
  if (!EanSchema.safeParse(digits).success || !hasValidCheckDigit(digits)) return undefined;
  return digits.length === 12 ? `0${digits}` : digits;
}
