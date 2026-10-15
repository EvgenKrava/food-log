import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';

describe('addDays', () => {
  it.each([
    ['2026-03-01', -1, '2026-02-28'],
    ['2024-03-01', -1, '2024-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-10-15', -29, '2026-09-16'],
    ['2026-10-15', 0, '2026-10-15'],
  ])('%s plus %i days → %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});
