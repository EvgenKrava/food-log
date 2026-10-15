import { describe, expect, it } from 'vitest';
import {
  CreateDiaryEntryRequestSchema,
  DiaryDaySchema,
  UpdateDiaryEntryRequestSchema,
} from './diary.ts';

const zero = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

describe('CreateDiaryEntryRequestSchema', () => {
  it('accepts a product entry', () => {
    expect(
      CreateDiaryEntryRequestSchema.safeParse({
        meal: 'lunch',
        item: { type: 'product', id: 'off-4820000000013' },
        grams: 150,
      }).success,
    ).toBe(true);
  });

  it('rejects unknown meals', () => {
    expect(
      CreateDiaryEntryRequestSchema.safeParse({
        meal: 'brunch',
        item: { type: 'product', id: 'off-4820000000013' },
        grams: 150,
      }).success,
    ).toBe(false);
  });
});

describe('UpdateDiaryEntryRequestSchema', () => {
  it('requires at least one field', () => {
    expect(UpdateDiaryEntryRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a grams-only change', () => {
    expect(UpdateDiaryEntryRequestSchema.safeParse({ grams: 80 }).success).toBe(true);
  });
});

describe('DiaryDaySchema', () => {
  it('parses an empty day without targets', () => {
    const r = DiaryDaySchema.safeParse({
      date: '2026-10-15',
      entries: [],
      totals: zero,
      byMeal: { breakfast: zero, lunch: zero, dinner: zero, snack: zero },
      targets: null,
    });
    expect(r.success).toBe(true);
  });
});
