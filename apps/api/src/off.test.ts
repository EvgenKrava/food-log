import { describe, expect, it } from 'vitest';
import { fromOff } from './off.ts';

describe('fromOff', () => {
  it('prefers the Ukrainian name and the first brand', () => {
    const p = fromOff({
      code: '4820000000000',
      product_name: 'Buckwheat',
      product_name_uk: 'Гречка',
      brands: 'Хуторок, Інше',
      nutriments: { 'energy-kcal_100g': 340, proteins_100g: 12.6, fat_100g: 3.3, carbohydrates_100g: 62 },
      serving_quantity: '50',
    });
    expect(p).toEqual({
      barcode: '4820000000000',
      name: 'Гречка',
      brand: 'Хуторок',
      servingSizeG: 50,
      per100g: { kcal: 340, protein: 12.6, fat: 3.3, carbs: 62 },
    });
  });

  it('converts kJ when kcal is missing and accepts brand arrays', () => {
    const p = fromOff({
      code: '4820000000000',
      product_name: 'X',
      brands: ['B'],
      nutriments: { energy_100g: 1000, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 },
    });
    expect(p?.per100g.kcal).toBe(239);
    expect(p?.brand).toBe('B');
  });

  it('drops records without macros or with an invalid barcode', () => {
    expect(fromOff({ code: '4820000000000', product_name: 'X', nutriments: {} })).toBeUndefined();
    expect(
      fromOff({
        code: '4820000000001',
        product_name: 'X',
        nutriments: { 'energy-kcal_100g': 1, proteins_100g: 0, fat_100g: 0, carbohydrates_100g: 0 },
      }),
    ).toBeUndefined();
  });
});
