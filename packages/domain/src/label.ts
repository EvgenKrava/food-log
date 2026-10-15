import {
  Per100gSchema,
  type DraftWarning,
  type LabelReading,
  type ProductDraft,
} from '@foodlog/contracts';
import { normalizeBarcode } from './barcode.ts';
import { hasKcalMismatch } from './nutrition.ts';

export const KJ_PER_KCAL = 4.184;

export type LabelNormalization =
  | { ok: true; draft: ProductDraft; warnings: DraftWarning[] }
  | { ok: false; code: 'SCAN_UNREADABLE' };

const round1 = (value: number): number => Math.round(value * 10) / 10;

// The model reports what is printed; all arithmetic (per-serving → per-100 g, kJ → kcal) happens
// here so it is deterministic and tested.
export function normalizeLabel(reading: LabelReading, scannedBarcode?: string): LabelNormalization {
  const name = reading.name?.trim() ?? '';
  const kcal =
    reading.energyKcal ??
    (reading.energyKj === undefined ? undefined : reading.energyKj / KJ_PER_KCAL);
  const printed = [kcal, reading.protein, reading.fat, reading.carbs];
  if (!reading.readable || (name === '' && printed.every((v) => v === undefined))) {
    return { ok: false, code: 'SCAN_UNREADABLE' };
  }

  const warnings: DraftWarning[] = [];
  let factor: number | undefined = 1;
  if (reading.basis === 'perServing') {
    if (reading.servingSizeG === undefined) {
      factor = undefined;
      warnings.push('SERVING_SIZE_REQUIRED');
    } else {
      factor = 100 / reading.servingSizeG;
    }
  }
  const convert = (value: number | undefined): number | undefined =>
    value === undefined || factor === undefined ? undefined : round1(value * factor);
  const per100g = {
    kcal: convert(kcal),
    protein: convert(reading.protein),
    fat: convert(reading.fat),
    carbs: convert(reading.carbs),
  };

  const hasGap = Object.values(per100g).some((v) => v === undefined);
  if (name === '' || (factor !== undefined && hasGap)) warnings.push('MISSING_VALUES');

  if (
    per100g.kcal !== undefined &&
    per100g.protein !== undefined &&
    per100g.fat !== undefined &&
    per100g.carbs !== undefined
  ) {
    const complete = {
      kcal: per100g.kcal,
      protein: per100g.protein,
      fat: per100g.fat,
      carbs: per100g.carbs,
    };
    if (!Per100gSchema.safeParse(complete).success) warnings.push('OUT_OF_RANGE');
    if (hasKcalMismatch(complete)) warnings.push('KCAL_MISMATCH');
  }

  const barcode = [scannedBarcode, reading.barcode]
    .map((candidate) => (candidate === undefined ? undefined : normalizeBarcode(candidate)))
    .find((candidate) => candidate !== undefined);
  const brand = reading.brand?.trim();

  const draft: ProductDraft = {
    name,
    per100g,
    ...(brand ? { brand } : {}),
    ...(barcode ? { barcode } : {}),
    ...(reading.servingSizeG === undefined ? {} : { servingSizeG: reading.servingSizeG }),
  };
  return { ok: true, draft, warnings };
}
