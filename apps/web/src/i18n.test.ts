import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, translate } from './i18n';

const SRC = new URL('.', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : [],
  );

// Every tr('…') literal, plus the label maps that are translated where they are shown.
const used = new Set<string>();
for (const f of files(SRC)) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\btr\('([^']+)'/g)) used.add(m[1] as string);
  if (/format\.ts$|Profile\.tsx$/.test(f)) {
    for (const m of text.matchAll(/\w+: '([^']+)'/g)) if (/[а-яії]/i.test(m[1] as string)) used.add(m[1] as string);
  }
}

describe('translations', () => {
  it('finds the UI strings', () => {
    expect(used.size).toBeGreaterThan(80);
  });

  for (const locale of LOCALES.filter((l) => l !== 'uk')) {
    it(`has every string in ${locale}`, () => {
      const missing = [...used].filter((k) => translate(locale, k) === k && !/^[\d\s/]*$/.test(k) && !['Каталог', 'Статистика', 'Назад', 'Перекус', 'Завтра', 'ккал', 'г', 'кг', 'Б', 'Ж', 'Ккал', '/100г', 'На 100 г', 'на 100 г'].includes(k));
      expect(missing).toEqual([]);
    });
  }

  it('fills placeholders', () => {
    expect(translate('en', 'Додати в «{meal}»', { meal: 'Lunch' })).toBe('Add to Lunch');
  });
});
