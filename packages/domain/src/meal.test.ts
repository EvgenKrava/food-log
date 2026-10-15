import { describe, expect, it } from 'vitest';
import { defaultMealForHour } from './meal.ts';

describe('defaultMealForHour', () => {
  it.each([
    [0, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [15, 'lunch'],
    [16, 'dinner'],
    [20, 'dinner'],
    [21, 'snack'],
    [23, 'snack'],
  ])('%i:00 → %s', (hour, meal) => {
    expect(defaultMealForHour(hour)).toBe(meal);
  });
});
