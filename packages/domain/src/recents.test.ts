import { describe, expect, it } from 'vitest';
import type { ItemRef } from '@foodlog/contracts';
import { RECENTS_LIMIT, deriveRecents, recentsWindow } from './recents.ts';

const ULID = '01JA2B3C4D5E6F7G8H9JKMNPQR';
const entry = (item: ItemRef, createdAt: string) => ({ item, createdAt });
const yogurt: ItemRef = { type: 'product', id: 'off-4820000000013' };
const dish: ItemRef = { type: 'dish', id: ULID };

describe('deriveRecents', () => {
  it('returns distinct items, newest first', () => {
    expect(
      deriveRecents([
        entry(yogurt, '2026-10-14T08:00:00.000Z'),
        entry(dish, '2026-10-15T12:00:00.000Z'),
        entry(yogurt, '2026-10-15T08:00:00.000Z'),
      ]),
    ).toEqual([dish, yogurt]);
  });

  it('treats a product and a dish with the same id as different items', () => {
    const sameIdProduct: ItemRef = { type: 'product', id: ULID };
    expect(
      deriveRecents([
        entry(dish, '2026-10-15T12:00:00.000Z'),
        entry(sameIdProduct, '2026-10-15T11:00:00.000Z'),
      ]),
    ).toEqual([dish, sameIdProduct]);
  });

  it(`caps the list at ${RECENTS_LIMIT} items`, () => {
    const entries = Array.from({ length: RECENTS_LIMIT + 5 }, (_, i) =>
      entry(
        { type: 'product', id: `off-${String(4820000000000 + i)}` },
        `2026-10-15T08:${String(i).padStart(2, '0')}:00.000Z`,
      ),
    );
    const recents = deriveRecents(entries);
    expect(recents).toHaveLength(RECENTS_LIMIT);
    expect(recents[0]).toEqual({ type: 'product', id: 'off-4820000000024' });
  });
});

describe('recentsWindow', () => {
  it('covers the last 30 days including today', () => {
    expect(recentsWindow('2026-10-15')).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });
});
