import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { cachedPlanLimits, DEFAULT_PLAN_LIMITS } from './plans.ts';
import type { AuthUser } from './auth.ts';
import { MemoryRepository } from './memory-repo.ts';
import { MemoryPhotoStore } from './memory-photos.ts';
import type { FoodFacts, LabelImage, LabelReader, OffProduct } from './ports.ts';
import type { LabelReading } from '@foodlog/contracts';
import { toReading } from './label-reader.ts';

const BUCKWHEAT: OffProduct = {
  barcode: '4820000000000',
  name: 'Гречка',
  brand: 'Хуторок',
  per100g: { kcal: 340, protein: 12.6, fat: 3.3, carbs: 62 },
};

class FakeOff implements FoodFacts {
  calls = 0;
  async search(q: string) {
    this.calls++;
    return q.startsWith('греч') ? [BUCKWHEAT] : [];
  }
  async byBarcode(b: string) {
    this.calls++;
    return b === BUCKWHEAT.barcode ? BUCKWHEAT : null;
  }
}

const ALICE: AuthUser = { sub: '11111111-1111-1111-1111-111111111111', email: 'a@x.io', groups: ['foodlog-user'] };
const BOB: AuthUser = { sub: '22222222-2222-2222-2222-222222222222', email: 'b@x.io', groups: ['foodlog-user'] };

function setup(user: AuthUser | null = ALICE, photos?: MemoryPhotoStore) {
  const repo = new MemoryRepository();
  const off = new FakeOff();
  const labels = new FakeLabels();
  let current = user;
  const app = createApp({
    repo,
    off,
    clock: () => new Date('2026-11-18T09:00:00Z'),
    planLimits: async () => ({
      plusGroup: 'plus',
      apps: { foodlog: { labelScansPerDay: { free: 2, plus: 4 }, historyDays: { free: 90, plus: null } } },
    }),
    identify: () => current,
    labels,
    scanLimits: { perUser: 2, global: 3 },
    ...(photos ? { photos } : {}),
  });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { repo, off, labels, call, as: (u: AuthUser | null) => (current = u) };
}

class FakeLabels implements LabelReader {
  reading: LabelReading = {
    readable: true,
    name: 'Йогурт',
    basis: 'perServing',
    servingSizeG: 200,
    energyKcal: 150,
    protein: 8,
    fat: 6,
    carbs: 16,
  };
  seen: LabelImage[] = [];
  async read(image: LabelImage) {
    this.seen.push(image);
    return this.reading;
  }
}

const IMAGE = { image: 'A'.repeat(200), mediaType: 'image/jpeg' };

describe('label scan', () => {
  it('returns a per-100 g draft from a per-serving label', async () => {
    const { call, labels } = setup();
    const r = await call('POST', '/scans', { ...IMAGE, barcode: '4820000000000' });
    expect(r.status).toBe(200);
    expect(r.body.draft).toEqual({
      name: 'Йогурт',
      barcode: '4820000000000',
      servingSizeG: 200,
      per100g: { kcal: 75, protein: 4, fat: 3, carbs: 8 },
    });
    expect(labels.seen[0]?.mediaType).toBe('image/jpeg');
  });

  it('answers 422 for an unreadable photo', async () => {
    const { call, labels } = setup();
    labels.reading = { readable: false, basis: 'per100g' };
    expect((await call('POST', '/scans', IMAGE)).body.error.code).toBe('SCAN_UNREADABLE');
  });

  it('rejects a body that is not base64', async () => {
    const { call } = setup();
    expect((await call('POST', '/scans', { ...IMAGE, image: '<script>'.repeat(30) })).status).toBe(400);
  });

  it('enforces the per-user and service-wide daily limits', async () => {
    const { call, as } = setup();
    expect((await call('POST', '/scans', IMAGE)).status).toBe(200);
    expect((await call('POST', '/scans', IMAGE)).status).toBe(200);
    expect((await call('POST', '/scans', IMAGE)).status).toBe(429);
    as(BOB);
    expect((await call('POST', '/scans', IMAGE)).status).toBe(200);
    expect((await call('POST', '/scans', IMAGE)).status).toBe(429);
  });

  it('maps model nulls to missing values', () => {
    expect(
      toReading({
        readable: true, name: 'X', brand: null, barcode: null, basis: 'per100g', servingSizeG: null,
        energyKcal: 100, energyKj: null, protein: null, fat: 1, carbs: 2,
      }),
    ).toEqual({ readable: true, name: 'X', basis: 'per100g', energyKcal: 100, fat: 1, carbs: 2 });
  });
});

describe('access', () => {
  it('rejects callers without a token', async () => {
    const { call } = setup(null);
    expect((await call('GET', '/diary/2026-11-18')).status).toBe(401);
  });

  it('requires the foodlog-user role but always answers /me', async () => {
    const { call } = setup({ ...ALICE, groups: [] });
    expect((await call('GET', '/diary/2026-11-18')).status).toBe(403);
    expect((await call('GET', '/me')).body).toMatchObject({ hasAccess: false });
  });
});

describe('diary', () => {
  it('logs an Open Food Facts product, snapshots values and keeps free history for 90 days', async () => {
    const { call, repo } = setup();
    const created = await call('POST', '/diary/2026-11-18/entries', {
      meal: 'breakfast',
      item: { type: 'product', id: `off-${BUCKWHEAT.barcode}` },
      grams: 150,
    });
    expect(created.status).toBe(201);
    expect(created.body.nutrients.kcal).toBeCloseTo(510);
    expect(repo.products.get(`off-${BUCKWHEAT.barcode}`)?.source).toBe('off');
    const [stored] = [...repo.entries.values()];
    expect(stored?.expiresAt).toBe(Date.parse('2026-11-18T00:00:00Z') / 1000 + 90 * 86400);

    const day = await call('GET', '/diary/2026-11-18');
    expect(day.body.entries).toHaveLength(1);
    expect(day.body.byMeal.breakfast.kcal).toBeCloseTo(510);
    expect(day.body.targets).toBeNull();
  });

  it('edits grams and deletes an entry', async () => {
    const { call } = setup();
    const { body: e } = await call('POST', '/diary/2026-11-18/entries', {
      meal: 'lunch',
      item: { type: 'product', id: `off-${BUCKWHEAT.barcode}` },
      grams: 100,
    });
    const patched = await call('PATCH', `/diary/2026-11-18/entries/${e.id}`, { grams: 200 });
    expect(patched.body.nutrients.kcal).toBeCloseTo(680);
    expect((await call('DELETE', `/diary/2026-11-18/entries/${e.id}`)).status).toBe(204);
    expect((await call('GET', '/diary/2026-11-18')).body.entries).toHaveLength(0);
  });

  it('does not let another user log a private product', async () => {
    const { call, as } = setup();
    const { body: p } = await call('POST', '/products', {
      name: 'Мій сирник',
      per100g: { kcal: 220, protein: 15, fat: 9, carbs: 20 },
      publish: false,
    });
    as(BOB);
    const res = await call('POST', '/diary/2026-11-18/entries', {
      meal: 'snack',
      item: { type: 'product', id: p.id },
      grams: 100,
    });
    expect(res.status).toBe(404);
  });

  it('rejects invalid grams', async () => {
    const { call } = setup();
    const res = await call('POST', '/diary/2026-11-18/entries', {
      meal: 'lunch',
      item: { type: 'product', id: `off-${BUCKWHEAT.barcode}` },
      grams: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('profile and targets', () => {
  const body = {
    sex: 'male',
    birthYear: 1990,
    heightCm: 180,
    activity: 'moderate',
    goal: 'maintain',
    locale: 'uk',
    targetsManual: false,
  };

  it('needs a weight to calculate targets', async () => {
    const { call } = setup();
    expect((await call('PUT', '/profile', body)).status).toBe(400);
  });

  it('calculates targets from the latest weight and shows them in the diary', async () => {
    const { call } = setup();
    await call('PUT', '/weight/2026-11-18', { kg: 80 });
    const saved = await call('PUT', '/profile', body);
    expect(saved.status).toBe(200);
    // BMR = 800 + 1125 - 180 + 5 = 1750; × 1.55 = 2712.5 → 2713
    expect(saved.body.profile.targets.kcal).toBe(2713);
    expect((await call('GET', '/diary/2026-11-18')).body.targets.kcal).toBe(2713);
    const profile = await call('GET', '/profile');
    expect(profile.body.currentWeightKg).toBe(80);
  });

  it('keeps manual targets', async () => {
    const { call } = setup();
    const targets = { kcal: 2000, protein: 150, fat: 60, carbs: 200 };
    await call('PUT', '/profile', { ...body, targetsManual: true, targets });
    expect((await call('GET', '/diary/2026-11-18')).body.targets).toEqual(targets);
  });
});

describe('search', () => {
  it('returns own matching products first, then Open Food Facts', async () => {
    const { call } = setup();
    await call('POST', '/products', {
      name: 'Гречаники домашні',
      per100g: { kcal: 180, protein: 12, fat: 8, carbs: 15 },
      publish: false,
    });
    const res = await call('GET', '/search?q=греч');
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Гречаники домашні', 'Гречка']);
    expect(res.body.items[0].isOwn).toBe(true);
  });

  it('shows recents for an empty query', async () => {
    const { call } = setup();
    await call('POST', '/diary/2026-11-18/entries', {
      meal: 'lunch',
      item: { type: 'product', id: `off-${BUCKWHEAT.barcode}` },
      grams: 100,
    });
    const res = await call('GET', '/search?q=');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(`off-${BUCKWHEAT.barcode}`);
  });

  it('finds a product by barcode and caches it', async () => {
    const { call, off } = setup();
    const first = await call('GET', `/products/barcode/${BUCKWHEAT.barcode}`);
    expect(first.body.name).toBe('Гречка');
    await call('GET', `/products/barcode/${BUCKWHEAT.barcode}`);
    expect(off.calls).toBe(1);
    expect((await call('GET', '/products/barcode/4820000000017')).status).toBe(404);
  });
});

describe('account data', () => {
  it('DELETE /me removes diary, weight, profile and own private products', async () => {
    const { call, repo } = setup();
    await call('PUT', '/weight/2026-11-18', { kg: 80 });
    await call('POST', '/products', {
      name: 'Каша',
      per100g: { kcal: 100, protein: 3, fat: 2, carbs: 18 },
      publish: false,
    });
    expect((await call('DELETE', '/me')).status).toBe(204);
    expect(repo.weights.size).toBe(0);
    expect(repo.products.size).toBe(0);
  });
});

describe('dishes', () => {
  const create = async (call: ReturnType<typeof setup>['call'], extra: object = {}) => {
    const { body: p } = await call('POST', '/products', {
      name: 'Сир',
      per100g: { kcal: 200, protein: 20, fat: 10, carbs: 5 },
      publish: false,
    });
    return call('POST', '/dishes', {
      name: 'Сирники',
      ingredients: [
        { productId: p.id, grams: 400 },
        { productId: `off-${BUCKWHEAT.barcode}`, grams: 100 },
      ],
      publish: false,
      ...extra,
    });
  };

  it('computes totals and per 100 g from snapshots, honouring cooked weight', async () => {
    const { call } = setup();
    const res = await create(call, { cookedWeightG: 400 });
    expect(res.status).toBe(201);
    expect(res.body.totals.kcal).toBeCloseTo(800 + 340);
    expect(res.body.weightG).toBe(400);
    expect(res.body.per100g.kcal).toBeCloseTo(285);
    expect(res.body.ingredients[1].name).toBe('Гречка');
  });

  it('logs a dish, shows it in search, recents and my items, and hides it from others', async () => {
    const { call, as } = setup();
    const { body: dish } = await create(call);
    const entry = await call('POST', '/diary/2026-11-18/entries', {
      meal: 'dinner',
      item: { type: 'dish', id: dish.id },
      grams: 250,
    });
    expect(entry.status).toBe(201);
    expect(entry.body.nutrients.kcal).toBeCloseTo((1140 / 500) * 250);
    expect((await call('GET', '/search?q=сирн')).body.items[0].type).toBe('dish');
    expect((await call('GET', '/recents')).body.items[0].id).toBe(dish.id);
    expect((await call('GET', '/me/items')).body.dishes).toHaveLength(1);
    as(BOB);
    expect((await call('GET', `/dishes/${dish.id}`)).status).toBe(404);
  });

  it('edits and deletes a dish', async () => {
    const { call } = setup();
    const { body: dish } = await create(call);
    const updated = await call('PUT', `/dishes/${dish.id}`, {
      name: 'Сирники 2',
      ingredients: dish.ingredients.slice(0, 1).map((i: { productId: string }) => ({ productId: i.productId, grams: 200 })),
    });
    expect(updated.body.totals.kcal).toBeCloseTo(400);
    expect((await call('DELETE', `/dishes/${dish.id}`)).status).toBe(204);
  });
});

describe('moderation', () => {
  const ADMIN: AuthUser = { sub: '33333333-3333-3333-3333-333333333333', email: 'm@x.io', groups: ['foodlog-admin'] };
  const product = { name: 'Хліб житній', per100g: { kcal: 220, protein: 7, fat: 1, carbs: 45 } };

  it('publishes, approves and then shows the product to other people', async () => {
    const { call, as } = setup();
    const { body: p } = await call('POST', '/products', { ...product, publish: false });
    expect((await call('POST', `/products/${p.id}/publish`)).body.status).toBe('pending');

    as(BOB);
    expect((await call('GET', '/search?q=хліб')).body.items).toHaveLength(0);
    expect((await call('GET', '/admin/queue')).status).toBe(403);

    as(ADMIN);
    const queue = (await call('GET', '/admin/queue')).body.items;
    expect(queue.map((i: { product: { id: string } }) => i.product.id)).toEqual([p.id]);
    expect((await call('POST', `/admin/products/${p.id}/approve`)).body.status).toBe('approved');
    expect((await call('GET', '/admin/queue')).body.items).toHaveLength(0);

    as(BOB);
    const found = (await call('GET', '/search?q=хліб')).body.items;
    expect(found.map((i: { id: string }) => i.id)).toEqual([p.id]);
    expect(found[0].isOwn).toBe(false);

    as(ADMIN);
    expect((await call('POST', `/admin/products/${p.id}/hide`)).body.status).toBe('hidden');
    as(BOB);
    expect((await call('GET', '/search?q=хліб')).body.items).toHaveLength(0);
  });

  it('rejects with a reason the author can see and lets them resubmit', async () => {
    const { call, as } = setup();
    const { body: d } = await call('POST', '/products', { ...product, publish: true });
    as(ADMIN);
    expect((await call('POST', `/admin/products/${d.id}/reject`, { reason: 'ok' })).status).toBe(400);
    await call('POST', `/admin/products/${d.id}/reject`, { reason: 'Перевірте калорійність' });
    as(ALICE);
    const mine = (await call('GET', '/me/items')).body.products[0];
    expect(mine).toMatchObject({ status: 'rejected', rejectReason: 'Перевірте калорійність' });
    const again = (await call('POST', `/products/${d.id}/publish`)).body;
    expect(again.status).toBe('pending');
    expect(again.rejectReason).toBeUndefined();
  });

  it('stops authors from approving their own items and others from publishing', async () => {
    const { call, as } = setup();
    const { body: p } = await call('POST', '/products', { ...product, publish: true });
    expect((await call('POST', `/admin/products/${p.id}/approve`)).status).toBe(403);
    as(BOB);
    expect((await call('POST', `/products/${p.id}/unpublish`)).status).toBe(404);
  });

  it('keeps approved items, unattributed, when the author deletes their data', async () => {
    const { call, as, repo } = setup();
    const { body: p } = await call('POST', '/products', { ...product, publish: true });
    as(ADMIN);
    await call('POST', `/admin/products/${p.id}/approve`);
    as(ALICE);
    expect((await call('DELETE', '/me')).status).toBe(204);
    expect(repo.products.get(p.id)?.ownerId).toBeUndefined();
    expect(repo.products.get(p.id)?.status).toBe('approved');
  });
});

describe('plans', () => {
  const PLUS: AuthUser = { ...ALICE, groups: ['foodlog-user', 'plus'] };
  const entry = { item: { type: 'product', id: `off-${BUCKWHEAT.barcode}` }, grams: 100, meal: 'lunch' };

  it('keeps free history 90 days from the entry date and Plus history forever', async () => {
    const { call, as, repo } = setup();
    const free = (await call('POST', '/diary/2026-11-10/entries', entry)).body;
    expect(repo.entries.get(`${ALICE.sub}#${free.id}`)?.expiresAt).toBe(Date.parse('2026-11-10T00:00:00Z') / 1000 + 90 * 86_400);
    as(PLUS);
    const plus = (await call('POST', '/diary/2026-11-10/entries', entry)).body;
    expect(repo.entries.get(`${ALICE.sub}#${plus.id}`)?.expiresAt).toBeUndefined();
  });

  it('tells the client its plan and limits', async () => {
    const { call, as } = setup();
    expect((await call('GET', '/me')).body).toMatchObject({ plan: 'free', limits: { labelScansPerDay: 2, historyDays: 90 } });
    as(PLUS);
    expect((await call('GET', '/me')).body).toMatchObject({ plan: 'plus', limits: { labelScansPerDay: 4, historyDays: null } });
  });

  it('gives Plus more scans and offers free users the upgrade', async () => {
    const { call, as } = setup({ ...ALICE, groups: ['foodlog-user', 'plus'] });
    for (let i = 0; i < 3; i++) expect((await call('POST', '/scans', IMAGE)).status).toBe(200);
    as(BOB);
    // The service-wide cap (3 in this setup) is reached, whatever the plan.
    expect((await call('POST', '/scans', IMAGE)).status).toBe(429);
  });

  it('includes the upgrade link when a free user hits the limit', async () => {
    const { call } = setup();
    await call('POST', '/scans', IMAGE);
    await call('POST', '/scans', IMAGE);
    const r = await call('POST', '/scans', IMAGE);
    expect(r.body.error.details).toEqual({ plan: 'free', limit: 2, upgradeUrl: 'https://onlytools.click/plus/' });
  });

  it('falls back to the defaults when the parameter is missing or malformed', async () => {
    expect(await cachedPlanLimits(async () => undefined)()).toEqual(DEFAULT_PLAN_LIMITS);
    expect(await cachedPlanLimits(async () => '{"nope":1}')()).toEqual(DEFAULT_PLAN_LIMITS);
    expect(await cachedPlanLimits(() => Promise.reject(new Error('denied')))()).toEqual(DEFAULT_PLAN_LIMITS);
  });
});

describe('item photos', () => {
  const ULID = '01KAB0000000000000000000AA';
  function withPhotos(user: AuthUser = ALICE) {
    const photos = new MemoryPhotoStore();
    const t = setup(user, photos);
    const upload = async () => {
      const res = await t.call('POST', '/photos/uploads');
      photos.uploaded(res.body.key);
      return res.body.key as string;
    };
    const product = async () =>
      (
        await t.call('POST', '/products', {
          name: 'Печиво',
          servingSizeG: 28,
          per100g: { kcal: 450, protein: 6, fat: 18, carbs: 66 },
          publish: false,
        })
      ).body
        .id as string;
    return { ...t, photos, upload, product };
  }

  it('attaches a photo to own product and shows it only to its author', async () => {
    const t = withPhotos();
    const id = await t.product();
    const key = await t.upload();
    expect(key).toMatch(new RegExp(`^uploads/${ALICE.sub}/`));
    const put = await t.call('PUT', `/photos/product/${id}`, { key });
    expect(put.status).toBe(200);
    expect(put.body.photoUrl).toMatch(new RegExp(`^https://foodlog.test/photos/${ALICE.sub}/`));
    expect(t.photos.objects.has(key)).toBe(false);

    expect((await t.call('GET', `/products/${id}`)).body.photoUrl).toBe(put.body.photoUrl);
    expect((await t.call('GET', '/me/items')).body.products[0].photoUrl).toBe(put.body.photoUrl);
    const found = (await t.call('GET', '/search?q=печ')).body.items[0];
    expect(found.photoUrl).toBe(put.body.photoUrl);
    expect(found.servingSizeG).toBe(28);
  });

  it('works on Open Food Facts products too', async () => {
    const t = withPhotos();
    const put = await t.call('PUT', `/photos/product/off-${BUCKWHEAT.barcode}`, { key: await t.upload() });
    expect(put.status).toBe(200);
    expect((await t.call('GET', `/products/barcode/${BUCKWHEAT.barcode}`)).body.photoUrl).toBe(put.body.photoUrl);
  });

  it('keeps photos personal: another user sees none and cannot use your upload', async () => {
    const t = withPhotos();
    const id = await t.call('POST', '/products', { name: 'Печиво', per100g: { kcal: 450, protein: 6, fat: 18, carbs: 66 }, publish: true });
    t.as({ sub: '33333333-3333-3333-3333-333333333333', email: 'm@x.io', groups: ['foodlog-admin'] });
    await t.call('POST', `/admin/products/${id.body.id}/approve`);
    t.as(ALICE);
    const key = await t.upload();
    await t.call('PUT', `/photos/product/${id.body.id}`, { key });
    t.as(BOB);
    expect((await t.call('GET', `/products/${id.body.id}`)).body.photoUrl).toBeUndefined();
    const stolen = await t.call('PUT', `/photos/product/${id.body.id}`, { key: `uploads/${ALICE.sub}/${ULID}.jpg` });
    expect(stolen.status).toBe(403);
  });

  it('replaces the old photo and deletes it from storage', async () => {
    const t = withPhotos();
    const id = await t.product();
    const first = await t.call('PUT', `/photos/product/${id}`, { key: await t.upload() });
    const second = await t.call('PUT', `/photos/product/${id}`, { key: await t.upload() });
    expect(second.body.photoUrl).not.toBe(first.body.photoUrl);
    expect([...t.photos.objects]).toEqual([second.body.photoUrl.replace('https://foodlog.test/', '')]);
  });

  it('answers 404 when nothing was uploaded', async () => {
    const t = withPhotos();
    const id = await t.product();
    const res = await t.call('PUT', `/photos/product/${id}`, { key: `uploads/${ALICE.sub}/${ULID}.jpg` });
    expect(res.status).toBe(404);
  });

  it('removes a photo, and drops it with the product', async () => {
    const t = withPhotos();
    const id = await t.product();
    await t.call('PUT', `/photos/product/${id}`, { key: await t.upload() });
    expect((await t.call('DELETE', `/photos/product/${id}`)).status).toBe(204);
    expect((await t.call('GET', `/products/${id}`)).body.photoUrl).toBeUndefined();
    expect(t.photos.objects.size).toBe(0);

    await t.call('PUT', `/photos/product/${id}`, { key: await t.upload() });
    await t.call('DELETE', `/products/${id}`);
    expect(t.photos.objects.size).toBe(0);
    expect(t.repo.photos.size).toBe(0);
  });

  it('attaches photos to dishes', async () => {
    const t = withPhotos();
    const productId = await t.product();
    const dish = await t.call('POST', '/dishes', { name: 'Печиво з молоком', ingredients: [{ productId, grams: 50 }], publish: false });
    const put = await t.call('PUT', `/photos/dish/${dish.body.id}`, { key: await t.upload() });
    expect(put.status).toBe(200);
    expect((await t.call('GET', `/dishes/${dish.body.id}`)).body.photoUrl).toBe(put.body.photoUrl);
  });

  it('deletes every photo with the account data', async () => {
    const t = withPhotos();
    const id = await t.product();
    await t.call('PUT', `/photos/product/${id}`, { key: await t.upload() });
    await t.upload();
    await t.call('DELETE', '/me');
    expect(t.photos.objects.size).toBe(0);
    expect(t.repo.photos.size).toBe(0);
  });

  it('answers 503 when photo storage is not configured', async () => {
    const t = setup();
    expect((await t.call('POST', '/photos/uploads')).status).toBe(503);
  });
});
