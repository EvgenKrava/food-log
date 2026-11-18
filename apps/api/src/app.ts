import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { ulid } from 'ulid';
import {
  CreateDiaryEntryRequestSchema,
  CreateDishRequestSchema,
  UlidSchema,
  UpdateDishRequestSchema,
  type Dish,
  type DishIngredient,
  CreateProductRequestSchema,
  HTTP_STATUS_BY_ERROR_CODE,
  IsoDateSchema,
  ProductIdSchema,
  ScanImageRequestSchema,
  type ScanResponse,
  PutProfileRequestSchema,
  PutWeightRequestSchema,
  SearchQuerySchema,
  StatsQuerySchema,
  UpdateDiaryEntryRequestSchema,
  UpdateProductRequestSchema,
  WeightQuerySchema,
  type CatalogItem,
  type DiaryEntry,
  type ErrorCode,
  type IsoDate,
  type ItemRef,
  type Product,
  type Profile,
  type ProfileResponse,
  type Targets,
} from '@foodlog/contracts';
import {
  DomainError,
  computeDish,
  computeTargets,
  deriveRecents,
  initialModerationState,
  matchesAllPrefixes,
  normalizeLabel,
  normalizeBarcode,
  recentsWindow,
  scaleNutrients,
  summarizeDay,
  sumNutrients,
} from '@foodlog/domain';
import { ACCESS_GROUP, ADMIN_GROUP, claimsFrom, type AuthUser } from './auth.ts';
import type {
  Clock,
  FoodFacts,
  LabelReader,
  OffProduct,
  Repository,
  ScanLimits,
  StoredDish,
  StoredProduct,
} from './ports.ts';

export type Deps = {
  repo: Repository;
  off: FoodFacts;
  clock: Clock;
  /** Days a diary entry or weight entry is kept for free users (core retention policy: 12 months). */
  historyDays: number;
  /** Reads label photos; scanning answers UPSTREAM_UNAVAILABLE without it. */
  labels?: LabelReader;
  scanLimits?: ScanLimits;
  /** Resolves the caller; production reads API Gateway JWT claims. */
  identify?: (c: Context) => AuthUser | null;
};

type Env = { Variables: { user: AuthUser } };

export const DEFAULT_SCAN_LIMITS: ScanLimits = { perUser: 20, global: 300 };

const fail = (code: ErrorCode, message: string, details?: unknown): never => {
  throw new DomainError(code, message, details);
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) fail('VALIDATION', 'Invalid request', z.treeifyError(r.error));
  return (r as { data: T }).data;
}

const offId = (barcode: string) => `off-${barcode}`;

function toProduct(p: StoredProduct, uid: string): Product {
  return {
    id: p.id,
    name: p.name,
    ...(p.brand ? { brand: p.brand } : {}),
    ...(p.barcode ? { barcode: p.barcode } : {}),
    ...(p.servingSizeG ? { servingSizeG: p.servingSizeG } : {}),
    per100g: p.per100g,
    source: p.source,
    status: p.status,
    isOwn: p.ownerId === uid,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toCatalogItem(p: StoredProduct, uid: string): CatalogItem {
  return {
    type: 'product',
    id: p.id,
    name: p.name,
    ...(p.brand ? { brand: p.brand } : {}),
    per100g: p.per100g,
    source: p.source,
    status: p.status,
    isOwn: p.ownerId === uid,
    isFavorite: false,
  };
}

function offToStored(o: OffProduct, now: string): StoredProduct {
  return {
    id: offId(o.barcode),
    name: o.name,
    ...(o.brand ? { brand: o.brand } : {}),
    barcode: o.barcode,
    ...(o.servingSizeG ? { servingSizeG: o.servingSizeG } : {}),
    per100g: o.per100g,
    source: 'off',
    status: 'approved',
    createdAt: now,
    updatedAt: now,
  };
}

/** A catalog item the caller may see: public, or their own. */
const visibleTo = (p: { status: string; ownerId?: string }, uid: string) =>
  p.status === 'approved' || p.ownerId === uid;

function toDish(d: StoredDish, uid: string): Dish {
  return {
    id: d.id,
    name: d.name,
    ingredients: d.ingredients as DishIngredient[],
    ...(d.cookedWeightG ? { cookedWeightG: d.cookedWeightG } : {}),
    totals: d.totals,
    weightG: d.weightG,
    per100g: d.per100g,
    status: d.status,
    isOwn: d.ownerId === uid,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function dishItem(d: StoredDish, uid: string): CatalogItem {
  return {
    type: 'dish',
    id: d.id,
    name: d.name,
    per100g: d.per100g,
    source: 'user',
    status: d.status,
    isOwn: d.ownerId === uid,
    isFavorite: false,
  };
}

export function createApp(deps: Deps) {
  const { repo, off, clock } = deps;
  const identify = deps.identify ?? ((c: Context) => claimsFrom(c.env?.event));
  const nowIso = () => clock().toISOString();
  const expiresAt = () => Math.floor(clock().getTime() / 1000) + deps.historyDays * 86_400;
  const today = () => nowIso().slice(0, 10);

  /** Looks a product up locally, then in Open Food Facts for `off-<ean>` ids (cached on first use). */
  async function resolveProduct(id: string, uid: string): Promise<StoredProduct> {
    const found = await repo.getProduct(id);
    if (found && visibleTo(found, uid)) return found;
    if (!found && id.startsWith('off-')) {
      const o = await off.byBarcode(id.slice(4)).catch(() => null);
      if (o) {
        const stored = offToStored(o, nowIso());
        await repo.putProduct(stored);
        return stored;
      }
    }
    return fail('NOT_FOUND', 'Product not found');
  }

  async function resolveDish(id: string, uid: string): Promise<StoredDish> {
    const d = await repo.getDish(id);
    if (!d || !visibleTo(d, uid)) return fail('NOT_FOUND', 'Dish not found');
    return d;
  }

  /** Snapshots each ingredient's name and values, then recomputes totals server-side. */
  async function buildDishContent(
    uid: string,
    req: { name: string; ingredients: { productId: string; grams: number }[]; cookedWeightG?: number },
  ) {
    const ingredients = await Promise.all(
      req.ingredients.map(async (i) => {
        const p = await resolveProduct(i.productId, uid);
        return { productId: p.id, grams: i.grams, name: p.name, per100g: p.per100g };
      }),
    );
    const computed = computeDish(ingredients, req.cookedWeightG);
    return {
      name: req.name,
      ingredients,
      ...(req.cookedWeightG ? { cookedWeightG: req.cookedWeightG } : {}),
      ...computed,
    };
  }

  async function effectiveTargets(uid: string, profile: Profile | null): Promise<Targets | null> {
    if (!profile) return null;
    if (profile.targetsManual) return profile.targets;
    const weight = await repo.latestWeight(uid);
    if (!weight) return profile.targets;
    return computeTargets({ ...profile, weightKg: weight.kg, currentYear: clock().getUTCFullYear() });
  }

  const app = new Hono<Env>().basePath('/api');

  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        HTTP_STATUS_BY_ERROR_CODE[err.code] as 400,
      );
    }
    console.error(err);
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, 500);
  });

  app.use('*', async (c, next) => {
    const user = identify(c);
    if (!user) return c.json({ error: { code: 'FORBIDDEN', message: 'unauthorized' } }, 401);
    c.set('user', user);
    if (c.req.path === '/api/me') return next();
    if (!user.groups.includes(ACCESS_GROUP)) fail('FORBIDDEN', 'no_access');
    return next();
  });

  app.get('/me', (c) => {
    const u = c.get('user');
    return c.json({
      email: u.email,
      hasAccess: u.groups.includes(ACCESS_GROUP),
      isAdmin: u.groups.includes(ADMIN_GROUP),
    });
  });

  // ---- profile & weight ----
  app.get('/profile', async (c) => {
    const uid = c.get('user').sub;
    const [profile, weight] = await Promise.all([repo.getProfile(uid), repo.latestWeight(uid)]);
    const suggested =
      profile && weight
        ? computeTargets({ ...profile, weightKg: weight.kg, currentYear: clock().getUTCFullYear() })
        : null;
    const body: ProfileResponse = {
      profile: profile ? { ...profile, targets: (await effectiveTargets(uid, profile)) ?? profile.targets } : null,
      currentWeightKg: weight?.kg ?? null,
      suggestedTargets: suggested,
    };
    return c.json(body);
  });

  app.put('/profile', async (c) => {
    const uid = c.get('user').sub;
    const req = parse(PutProfileRequestSchema, await c.req.json());
    let targets: Targets;
    if (req.targetsManual && req.targets) targets = req.targets;
    else {
      const weight = await repo.latestWeight(uid);
      if (!weight) return fail('VALIDATION', 'Add your weight first to calculate targets');
      targets = computeTargets({ ...req, weightKg: weight.kg, currentYear: clock().getUTCFullYear() });
    }
    const profile: Profile = {
      sex: req.sex,
      birthYear: req.birthYear,
      heightCm: req.heightCm,
      activity: req.activity,
      goal: req.goal,
      locale: req.locale,
      targetsManual: req.targetsManual,
      targets,
    };
    await repo.putProfile(uid, profile);
    return c.json({ profile });
  });

  app.get('/weight', async (c) => {
    const q = parse(WeightQuerySchema, c.req.query());
    return c.json({ entries: await repo.listWeights(c.get('user').sub, q.from, q.to) });
  });

  app.put('/weight/:date', async (c) => {
    const date = parse(IsoDateSchema, c.req.param('date'));
    const { kg } = parse(PutWeightRequestSchema, await c.req.json());
    const entry = { date, kg };
    await repo.putWeight(c.get('user').sub, entry, expiresAt());
    return c.json(entry);
  });

  app.delete('/weight/:date', async (c) => {
    await repo.deleteWeight(c.get('user').sub, parse(IsoDateSchema, c.req.param('date')));
    return c.body(null, 204);
  });

  // ---- diary ----
  async function dayView(uid: string, date: IsoDate) {
    const [entries, profile] = await Promise.all([
      repo.listEntries(uid, date, date),
      repo.getProfile(uid),
    ]);
    entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { date, entries, ...summarizeDay(entries), targets: await effectiveTargets(uid, profile) };
  }

  app.get('/diary/:date', async (c) =>
    c.json(await dayView(c.get('user').sub, parse(IsoDateSchema, c.req.param('date')))),
  );

  app.post('/diary/:date/entries', async (c) => {
    const uid = c.get('user').sub;
    const date = parse(IsoDateSchema, c.req.param('date'));
    const req = parse(CreateDiaryEntryRequestSchema, await c.req.json());
    const source =
      req.item.type === 'dish'
        ? await resolveDish(req.item.id, uid)
        : await resolveProduct(req.item.id, uid);
    const brand = 'brand' in source ? source.brand : undefined;
    const entry: DiaryEntry = {
      id: ulid(clock().getTime()),
      date,
      meal: req.meal,
      item: { type: req.item.type, id: source.id } as ItemRef,
      name: brand ? `${source.name} · ${brand}` : source.name,
      per100g: source.per100g,
      grams: req.grams,
      nutrients: scaleNutrients(source.per100g, req.grams),
      createdAt: nowIso(),
    };
    await repo.putEntry(uid, entry, expiresAt());
    return c.json(entry, 201);
  });

  app.patch('/diary/:date/entries/:id', async (c) => {
    const uid = c.get('user').sub;
    const date = parse(IsoDateSchema, c.req.param('date'));
    const req = parse(UpdateDiaryEntryRequestSchema, await c.req.json());
    const entry = await repo.getEntry(uid, date, c.req.param('id'));
    if (!entry) return fail('NOT_FOUND', 'Entry not found');
    const grams = req.grams ?? entry.grams;
    const updated: DiaryEntry = {
      ...entry,
      meal: req.meal ?? entry.meal,
      grams,
      nutrients: scaleNutrients(entry.per100g, grams),
    };
    await repo.putEntry(uid, updated, expiresAt());
    return c.json(updated);
  });

  app.delete('/diary/:date/entries/:id', async (c) => {
    const date = parse(IsoDateSchema, c.req.param('date'));
    await repo.deleteEntry(c.get('user').sub, date, c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/stats', async (c) => {
    const uid = c.get('user').sub;
    const q = parse(StatsQuerySchema, c.req.query());
    const [entries, profile] = await Promise.all([
      repo.listEntries(uid, q.from, q.to),
      repo.getProfile(uid),
    ]);
    const byDay = new Map<string, DiaryEntry[]>();
    for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    const days = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({ date, totals: sumNutrients(list.map((e) => e.nutrients)) }));
    return c.json({ days, targets: await effectiveTargets(uid, profile) });
  });

  // ---- catalog ----
  async function recents(uid: string): Promise<CatalogItem[]> {
    const w = recentsWindow(today());
    const entries = await repo.listEntries(uid, w.from, w.to);
    const items = await Promise.all(
      deriveRecents(entries).map(async (r): Promise<CatalogItem | null> => {
        if (r.type === 'dish') {
          const d = await repo.getDish(r.id);
          return d && visibleTo(d, uid) ? dishItem(d, uid) : null;
        }
        const p = await repo.getProduct(r.id);
        return p && visibleTo(p, uid) ? toCatalogItem(p, uid) : null;
      }),
    );
    return items.filter((i): i is CatalogItem => i !== null);
  }

  app.get('/recents', async (c) => c.json({ items: await recents(c.get('user').sub) }));

  app.get('/search', async (c) => {
    const uid = c.get('user').sub;
    const q = parse(SearchQuerySchema, c.req.query());
    const query = q.q.trim();
    if (!query) return c.json({ items: await recents(uid) });
    const dishes =
      q.type === 'product'
        ? []
        : (await repo.listOwnDishes(uid))
            .filter((d) => matchesAllPrefixes(d.name, query))
            .map((d) => dishItem(d, uid));
    if (q.type === 'dish') return c.json({ items: dishes });

    const barcode = /^\d{8,14}$/.test(query) ? normalizeBarcode(query) : undefined;
    const [own, remote] = await Promise.all([
      repo.listOwnProducts(uid),
      barcode
        ? off.byBarcode(barcode).then((p) => (p ? [p] : []), () => [])
        : off.search(query).catch((err: unknown) => {
            console.warn('OFF search failed', err);
            return [] as OffProduct[];
          }),
    ]);
    const mine = own.filter((p) =>
      barcode ? p.barcode === barcode : matchesAllPrefixes(`${p.name} ${p.brand ?? ''}`, query),
    );
    const now = nowIso();
    const items = [
      ...dishes,
      ...mine.map((p) => toCatalogItem(p, uid)),
      ...remote.map((o) => toCatalogItem(offToStored(o, now), uid)),
    ];
    return c.json({ items: items.slice(0, 40) });
  });

  app.get('/products/barcode/:ean', async (c) => {
    const uid = c.get('user').sub;
    const barcode = normalizeBarcode(c.req.param('ean'));
    if (!barcode) return fail('VALIDATION', 'Invalid barcode');
    const local = (await repo.findByBarcode(barcode)).filter((p) => visibleTo(p, uid));
    const pick = local.find((p) => p.status === 'approved') ?? local[0];
    if (pick) return c.json(toProduct(pick, uid));
    return c.json(toProduct(await resolveProduct(offId(barcode), uid), uid));
  });

  app.get('/me/items', async (c) => {
    const uid = c.get('user').sub;
    const [products, dishes] = await Promise.all([repo.listOwnProducts(uid), repo.listOwnDishes(uid)]);
    return c.json({
      products: products.map((p) => toProduct(p, uid)),
      dishes: dishes.map((d) => toDish(d, uid)),
    });
  });

  app.post('/products', async (c) => {
    const uid = c.get('user').sub;
    const req = parse(CreateProductRequestSchema, await c.req.json());
    const now = nowIso();
    const state = initialModerationState(req.publish, now);
    const product: StoredProduct = {
      id: ulid(clock().getTime()),
      name: req.name,
      ...(req.brand ? { brand: req.brand } : {}),
      ...(req.barcode ? { barcode: req.barcode } : {}),
      ...(req.servingSizeG ? { servingSizeG: req.servingSizeG } : {}),
      per100g: req.per100g,
      source: 'user',
      ownerId: uid,
      status: state.status,
      createdAt: now,
      updatedAt: now,
    };
    await repo.putProduct(product);
    return c.json(toProduct(product, uid), 201);
  });

  app.get('/products/:id', async (c) => {
    const uid = c.get('user').sub;
    const id = parse(ProductIdSchema, c.req.param('id'));
    return c.json(toProduct(await resolveProduct(id, uid), uid));
  });

  async function ownProduct(id: string, uid: string): Promise<StoredProduct> {
    const p = await repo.getProduct(id);
    if (!p || p.ownerId !== uid) return fail('NOT_FOUND', 'Product not found');
    return p;
  }

  app.put('/products/:id', async (c) => {
    const uid = c.get('user').sub;
    const p = await ownProduct(c.req.param('id'), uid);
    if (p.status === 'approved') return fail('CONFLICT', 'Published products cannot be edited yet');
    const req = parse(UpdateProductRequestSchema, await c.req.json());
    const updated: StoredProduct = {
      id: p.id,
      source: p.source,
      ownerId: uid,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: nowIso(),
      name: req.name,
      ...(req.brand ? { brand: req.brand } : {}),
      ...(req.barcode ? { barcode: req.barcode } : {}),
      ...(req.servingSizeG ? { servingSizeG: req.servingSizeG } : {}),
      per100g: req.per100g,
    };
    await repo.putProduct(updated);
    return c.json(toProduct(updated, uid));
  });

  app.delete('/products/:id', async (c) => {
    const uid = c.get('user').sub;
    const p = await ownProduct(c.req.param('id'), uid);
    if (p.status === 'approved') return fail('CONFLICT', 'Published products cannot be deleted');
    await repo.deleteProduct(p.id);
    return c.body(null, 204);
  });

  // ---- dishes ----
  app.post('/dishes', async (c) => {
    const uid = c.get('user').sub;
    const req = parse(CreateDishRequestSchema, await c.req.json());
    const now = nowIso();
    const dish: StoredDish = {
      id: ulid(clock().getTime()),
      ownerId: uid,
      ...(await buildDishContent(uid, req)),
      status: initialModerationState(req.publish, now).status,
      createdAt: now,
      updatedAt: now,
    };
    await repo.putDish(dish);
    return c.json(toDish(dish, uid), 201);
  });

  app.get('/dishes/:id', async (c) => {
    const uid = c.get('user').sub;
    return c.json(toDish(await resolveDish(parse(UlidSchema, c.req.param('id')), uid), uid));
  });

  async function ownDish(id: string, uid: string): Promise<StoredDish> {
    const d = await repo.getDish(id);
    if (!d || d.ownerId !== uid) return fail('NOT_FOUND', 'Dish not found');
    return d;
  }

  app.put('/dishes/:id', async (c) => {
    const uid = c.get('user').sub;
    const d = await ownDish(c.req.param('id'), uid);
    if (d.status === 'approved') return fail('CONFLICT', 'Published dishes cannot be edited yet');
    const req = parse(UpdateDishRequestSchema, await c.req.json());
    const updated: StoredDish = {
      id: d.id,
      ownerId: uid,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: nowIso(),
      ...(await buildDishContent(uid, req)),
    };
    await repo.putDish(updated);
    return c.json(toDish(updated, uid));
  });

  app.delete('/dishes/:id', async (c) => {
    const uid = c.get('user').sub;
    const d = await ownDish(c.req.param('id'), uid);
    if (d.status === 'approved') return fail('CONFLICT', 'Published dishes cannot be deleted');
    await repo.deleteDish(d.id);
    return c.body(null, 204);
  });

  /** Removes the caller's FoodLog data; the Only Tools account itself stays. */
  app.post('/scans', async (c) => {
    const req = parse(ScanImageRequestSchema, await c.req.json().catch(() => null));
    if (!deps.labels) return fail('UPSTREAM_UNAVAILABLE', 'label scanning is not configured');
    const limits = deps.scanLimits ?? DEFAULT_SCAN_LIMITS;
    const twoDays = Math.floor(clock().getTime() / 1000) + 2 * 86_400;
    if (!(await repo.consumeScanQuota(c.get('user').sub, today(), limits, twoDays))) {
      return fail('QUOTA_EXCEEDED', 'daily scan limit reached', { perUser: limits.perUser });
    }
    const reading = await deps.labels.read({ data: req.image, mediaType: req.mediaType });
    const result = normalizeLabel(reading, req.barcode);
    if (!result.ok) return fail('SCAN_UNREADABLE', 'could not read the label');
    const body: ScanResponse = { draft: result.draft, warnings: result.warnings };
    return c.json(body);
  });

  app.delete('/me', async (c) => {
    const uid = c.get('user').sub;
    for (const p of await repo.listOwnProducts(uid)) {
      if (p.status !== 'approved') await repo.deleteProduct(p.id);
    }
    for (const d of await repo.listOwnDishes(uid)) {
      if (d.status !== 'approved') await repo.deleteDish(d.id);
    }
    await repo.deleteUserData(uid);
    return c.body(null, 204);
  });

  return app;
}
