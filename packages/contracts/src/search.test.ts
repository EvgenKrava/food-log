import { describe, expect, it } from 'vitest';
import { CatalogItemSchema, SEARCH_QUERY_MAX, SearchQuerySchema } from './search.ts';
import { StatsQuerySchema } from './stats.ts';
import { WeightQuerySchema } from './weight.ts';

describe('SearchQuerySchema', () => {
  it('defaults to an empty query over all item types', () => {
    expect(SearchQuerySchema.parse({})).toEqual({ q: '', type: 'all' });
  });

  it('rejects overly long queries and unknown types', () => {
    expect(SearchQuerySchema.safeParse({ q: 'а'.repeat(SEARCH_QUERY_MAX + 1) }).success).toBe(
      false,
    );
    expect(SearchQuerySchema.safeParse({ type: 'drink' }).success).toBe(false);
  });
});

describe('CatalogItemSchema', () => {
  it('parses a user dish item', () => {
    const r = CatalogItemSchema.safeParse({
      type: 'dish',
      id: '01JA2B3C4D5E6F7G8H9JKMNPQR',
      name: 'Гречка з маслом',
      per100g: { kcal: 167.1, protein: 5.3, fat: 4.7, carbs: 27.2 },
      source: 'user',
      status: 'private',
      isOwn: true,
      isFavorite: false,
    });
    expect(r.success).toBe(true);
  });
});

describe('range queries', () => {
  it('limits stats to 31 days', () => {
    expect(StatsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success).toBe(true);
    expect(StatsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-11-01' }).success).toBe(
      false,
    );
  });

  it('limits weight history to 366 days (a full leap year)', () => {
    expect(WeightQuerySchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success).toBe(
      true,
    );
    expect(WeightQuerySchema.safeParse({ from: '2024-01-01', to: '2025-01-01' }).success).toBe(
      false,
    );
  });
});
