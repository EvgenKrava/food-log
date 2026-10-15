import type { Meal } from '@foodlog/contracts';

// Spec §11: before 11:00 breakfast, 11:00–16:00 lunch, 16:00–21:00 dinner, otherwise snack.
export function defaultMealForHour(hour: number): Meal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
