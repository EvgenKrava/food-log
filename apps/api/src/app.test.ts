import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import type { AuthUser } from './auth.ts';
import { MemoryRepository } from './memory-repo.ts';
import type { FoodFacts, OffProduct } from './ports.ts';

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

function setup(user: AuthUser | null = ALICE) {
  const repo = new MemoryRepository();
  const off = new FakeOff();
  let current = user;
  const app = createApp({
    repo,
    off,
    clock: () => new Date('2026-11-18T09:00:00Z'),
    historyDays: 365,
    identify: () => current,
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
  return { repo, off, call, as: (u: AuthUser | null) => (current = u) };
}

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
  it('logs an Open Food Facts product, snapshots values and keeps history for a year', async () => {
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
    expect(stored?.expiresAt).toBe(Date.parse('2026-11-18T09:00:00Z') / 1000 + 365 * 86400);

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
