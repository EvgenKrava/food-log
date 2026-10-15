// Shared by the search index and the matching of a user's own items, so both normalize text
// identically. The MiniSearch index must use `tokenize` as its tokenizer (its default splits on
// punctuation, which would cut "м'ясо" before apostrophes are stripped) and `normalizeSearchText`
// as its processTerm.
const APOSTROPHES = /['’ʼ`]/g;

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(APOSTROPHES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeSearchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

export function matchesAllPrefixes(haystack: string, query: string): boolean {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return false;
  const tokens = tokenize(haystack);
  return queryTokens.every((q) => tokens.some((token) => token.startsWith(q)));
}
