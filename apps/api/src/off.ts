import { Per100gSchema } from '@foodlog/contracts';
import { KJ_PER_KCAL, normalizeBarcode } from '@foodlog/domain';
import type { FoodFacts, OffProduct } from './ports.ts';

const USER_AGENT = 'FoodLog/1.0 (https://foodlog.onlytools.click)';
const TIMEOUT_MS = 3000;
const FIELDS =
  'code,product_name,product_name_uk,product_name_en,product_name_ru,brands,nutriments,serving_quantity';

type OffRaw = {
  code?: unknown;
  product_name?: unknown;
  product_name_uk?: unknown;
  product_name_en?: unknown;
  product_name_ru?: unknown;
  brands?: unknown;
  nutriments?: Record<string, unknown>;
  serving_quantity?: unknown;
};

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Turns one OFF record into a product, or undefined when it lacks a valid barcode, name or macros. */
export function fromOff(raw: OffRaw): OffProduct | undefined {
  const barcode = typeof raw.code === 'string' ? normalizeBarcode(raw.code) : undefined;
  const name =
    text(raw.product_name_uk) ??
    text(raw.product_name_en) ??
    text(raw.product_name) ??
    text(raw.product_name_ru);
  if (!barcode || !name) return undefined;
  const n = raw.nutriments ?? {};
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj === undefined ? undefined : kj / KJ_PER_KCAL);
  const parsed = Per100gSchema.safeParse({
    kcal: kcal === undefined ? undefined : round(kcal, 1),
    protein: num(n['proteins_100g']),
    fat: num(n['fat_100g']),
    carbs: num(n['carbohydrates_100g']),
  });
  if (!parsed.success) return undefined;
  const brands = Array.isArray(raw.brands) ? raw.brands[0] : raw.brands;
  const brand = text(typeof brands === 'string' ? brands.split(',')[0] : undefined);
  const serving = num(raw.serving_quantity);
  return {
    barcode,
    name: name.slice(0, 120),
    ...(brand ? { brand: brand.slice(0, 80) } : {}),
    ...(serving && serving > 0 && serving <= 5000 ? { servingSizeG: serving } : {}),
    per100g: parsed.data,
  };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  return res.json();
}

export class HttpFoodFacts implements FoodFacts {
  async search(query: string): Promise<OffProduct[]> {
    const url = new URL('https://search.openfoodfacts.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('langs', 'uk,en,ru');
    url.searchParams.set('page_size', '25');
    url.searchParams.set('fields', FIELDS);
    const body = (await getJson(url.toString())) as { hits?: OffRaw[] } | null;
    const seen = new Set<string>();
    const out: OffProduct[] = [];
    for (const hit of body?.hits ?? []) {
      const p = fromOff(hit);
      if (!p || seen.has(p.barcode)) continue;
      seen.add(p.barcode);
      out.push(p);
    }
    return out;
  }

  async byBarcode(barcode: string): Promise<OffProduct | null> {
    const body = (await getJson(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${FIELDS}`,
    )) as { status?: number; product?: OffRaw } | null;
    if (!body || body.status !== 1 || !body.product) return null;
    return fromOff({ ...body.product, code: body.product.code ?? barcode }) ?? null;
  }
}
