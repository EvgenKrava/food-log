import { describe, expect, it } from 'vitest';
import type { LabelReading } from '@foodlog/contracts';
import { normalizeLabel } from './label.ts';

const yogurt: LabelReading = {
  readable: true,
  name: ' Йогурт персик ',
  brand: 'Галичина',
  basis: 'per100g',
  energyKcal: 72,
  protein: 3.3,
  fat: 1.3,
  carbs: 11.3,
};

describe('normalizeLabel', () => {
  it('passes per-100 g values through and trims text', () => {
    expect(normalizeLabel(yogurt)).toEqual({
      ok: true,
      draft: {
        name: 'Йогурт персик',
        brand: 'Галичина',
        per100g: { kcal: 72, protein: 3.3, fat: 1.3, carbs: 11.3 },
      },
      warnings: [],
    });
  });

  it('converts per-serving values to per 100 g, rounded to 0.1, and keeps the serving size', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Батончик',
      basis: 'perServing',
      servingSizeG: 30,
      energyKcal: 120,
      protein: 3,
      fat: 6,
      carbs: 14,
    });
    expect(result).toEqual({
      ok: true,
      draft: {
        name: 'Батончик',
        servingSizeG: 30,
        per100g: { kcal: 400, protein: 10, fat: 20, carbs: 46.7 },
      },
      warnings: [],
    });
  });

  it('leaves per-100 g values empty when a per-serving label has no serving size', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Батончик',
      basis: 'perServing',
      energyKcal: 120,
      protein: 3,
      fat: 6,
      carbs: 14,
    });
    expect(result).toEqual({
      ok: true,
      draft: {
        name: 'Батончик',
        per100g: { kcal: undefined, protein: undefined, fat: undefined, carbs: undefined },
      },
      warnings: ['SERVING_SIZE_REQUIRED'],
    });
  });

  it('derives kcal from kJ when only kJ is printed', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Мюслі',
      basis: 'per100g',
      energyKj: 1500,
      protein: 10,
      fat: 20,
      carbs: 40,
    });
    expect(result.ok && result.draft.per100g.kcal).toBe(358.5);
    expect(result.ok && result.warnings).toEqual([]);
  });

  it('prefers printed kcal over kJ', () => {
    const result = normalizeLabel({ ...yogurt, energyKj: 9999 });
    expect(result.ok && result.draft.per100g.kcal).toBe(72);
  });

  it('flags missing values', () => {
    const result = normalizeLabel({ ...yogurt, fat: undefined });
    expect(result.ok && result.warnings).toEqual(['MISSING_VALUES']);
  });

  it('flags a missing name', () => {
    const result = normalizeLabel({ ...yogurt, name: '  ' });
    expect(result.ok && result.warnings).toEqual(['MISSING_VALUES']);
  });

  it('flags a kcal value that disagrees with the macros', () => {
    const result = normalizeLabel({ ...yogurt, energyKcal: 720 });
    expect(result.ok && result.warnings).toEqual(['KCAL_MISMATCH']);
  });

  it('flags impossible per-100 g values', () => {
    const result = normalizeLabel({
      readable: true,
      name: 'Помилка',
      basis: 'per100g',
      energyKcal: 590,
      protein: 60,
      fat: 30,
      carbs: 20,
    });
    expect(result.ok && result.warnings).toEqual(['OUT_OF_RANGE']);
  });

  it('prefers the scanned barcode, then a valid printed one, and canonicalizes UPC-A', () => {
    const printed = { ...yogurt, barcode: '4820000000024' };
    expect(normalizeLabel(printed, '4820000000017')).toMatchObject({
      draft: { barcode: '4820000000017' },
    });
    expect(normalizeLabel(printed)).toMatchObject({ draft: { barcode: '4820000000024' } });
    expect(normalizeLabel({ ...yogurt, barcode: '012345678905' })).toMatchObject({
      draft: { barcode: '0012345678905' },
    });
    const noBarcode = normalizeLabel({ ...yogurt, barcode: 'not a code' });
    expect(noBarcode.ok).toBe(true);
    expect(noBarcode.ok && noBarcode.draft).not.toHaveProperty('barcode');
    expect(normalizeLabel({ ...yogurt, barcode: '4820000000013' })).not.toHaveProperty(
      'draft.barcode',
    );
  });

  it.each([
    ['the model marks it unreadable', { ...yogurt, readable: false }],
    ['there is no name and no value', { readable: true, basis: 'per100g' } satisfies LabelReading],
  ])('returns SCAN_UNREADABLE when %s', (_label, reading) => {
    expect(normalizeLabel(reading)).toEqual({ ok: false, code: 'SCAN_UNREADABLE' });
  });
});
