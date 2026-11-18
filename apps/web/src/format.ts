import type { Meal } from '@foodlog/contracts';
import { activeLocale, intlTag, tr } from './i18n';

const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Сніданок',
  lunch: 'Обід',
  dinner: 'Вечеря',
  snack: 'Перекус',
};
export const mealLabel = (m: Meal) => tr(MEAL_LABEL[m]);

export const kcal = (n: number) => Math.round(n).toLocaleString(intlTag(activeLocale()));
export const grams = (n: number) => (Math.round(n * 10) / 10).toLocaleString(intlTag(activeLocale()));

/** The user's local calendar date, YYYY-MM-DD. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export function dateTitle(date: string): string {
  const today = localDate();
  if (date === today) return tr('Сьогодні');
  if (date === shiftDate(today, -1)) return tr('Вчора');
  if (date === shiftDate(today, 1)) return tr('Завтра');
  return new Date(`${date}T12:00:00`).toLocaleDateString(intlTag(activeLocale()), {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
