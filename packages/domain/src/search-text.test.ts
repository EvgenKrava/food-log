import { describe, expect, it } from 'vitest';
import { matchesAllPrefixes, normalizeSearchText, tokenize } from './search-text.ts';

describe('normalizeSearchText', () => {
  it('lowercases, maps ё to е and collapses whitespace', () => {
    expect(normalizeSearchText('  Йогурт   ЁЖИК ')).toBe('йогурт ежик');
  });

  it.each(["М'ясо", 'М’ясо', 'Мʼясо', 'М`ясо'])('strips the apostrophe in %s', (text) => {
    expect(normalizeSearchText(text)).toBe('мясо');
  });

  it('applies NFKC (full-width digits become ASCII)', () => {
    expect(normalizeSearchText('Молоко ２.５%')).toBe('молоко 2.5%');
  });
});

describe('tokenize', () => {
  it('splits on anything that is not a letter or digit', () => {
    expect(tokenize('Сир кисломолочний 5%, Галичина')).toEqual([
      'сир',
      'кисломолочний',
      '5',
      'галичина',
    ]);
  });

  it('returns no tokens for punctuation only', () => {
    expect(tokenize(' ,.- ')).toEqual([]);
  });
});

describe('matchesAllPrefixes', () => {
  const name = 'Сир кисломолочний Галичина';

  it('matches when every query token prefixes some word, in any order', () => {
    expect(matchesAllPrefixes(name, 'гал сир')).toBe(true);
    expect(matchesAllPrefixes(name, 'кисло')).toBe(true);
  });

  it('does not match a missing word or an empty query', () => {
    expect(matchesAllPrefixes(name, 'молоко')).toBe(false);
    expect(matchesAllPrefixes(name, '   ')).toBe(false);
  });

  it('matches across apostrophe variants', () => {
    expect(matchesAllPrefixes('Мʼясо куряче', "м'яс")).toBe(true);
  });
});
