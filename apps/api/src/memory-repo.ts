import type { DiaryEntry, IsoDate, Profile, WeightEntry } from '@foodlog/contracts';
import type { Repository, ScanLimits, StoredDish, StoredProduct } from './ports.ts';

/** In-memory Repository for tests and local development. */
export class MemoryRepository implements Repository {
  readonly products = new Map<string, StoredProduct>();
  readonly dishes = new Map<string, StoredDish>();

  async getDish(id: string) {
    return this.dishes.get(id) ?? null;
  }
  async putDish(d: StoredDish) {
    this.dishes.set(d.id, d);
  }
  async deleteDish(id: string) {
    this.dishes.delete(id);
  }
  async listOwnDishes(ownerId: string) {
    return [...this.dishes.values()]
      .filter((d) => d.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  readonly entries = new Map<string, { entry: DiaryEntry; expiresAt: number }>();
  readonly profiles = new Map<string, Profile>();
  readonly weights = new Map<string, { entry: WeightEntry; expiresAt: number }>();
  readonly scanCounts = new Map<string, number>();

  async getProduct(id: string) {
    return this.products.get(id) ?? null;
  }
  async putProduct(p: StoredProduct) {
    this.products.set(p.id, p);
  }
  async deleteProduct(id: string) {
    this.products.delete(id);
  }
  async listOwnProducts(ownerId: string) {
    return [...this.products.values()]
      .filter((p) => p.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async findByBarcode(barcode: string) {
    return [...this.products.values()].filter((p) => p.barcode === barcode);
  }

  async listEntries(uid: string, from: IsoDate, to: IsoDate) {
    return [...this.entries.entries()]
      .filter(([k, v]) => k.startsWith(`${uid}#`) && v.entry.date >= from && v.entry.date <= to)
      .map(([, v]) => v.entry);
  }
  async getEntry(uid: string, date: IsoDate, id: string) {
    const e = this.entries.get(`${uid}#${id}`)?.entry;
    return e && e.date === date ? e : null;
  }
  async putEntry(uid: string, entry: DiaryEntry, expiresAt: number) {
    this.entries.set(`${uid}#${entry.id}`, { entry, expiresAt });
  }
  async deleteEntry(uid: string, _date: IsoDate, id: string) {
    this.entries.delete(`${uid}#${id}`);
  }

  async getProfile(uid: string) {
    return this.profiles.get(uid) ?? null;
  }
  async putProfile(uid: string, profile: Profile) {
    this.profiles.set(uid, profile);
  }

  async listWeights(uid: string, from: IsoDate, to: IsoDate) {
    return [...this.weights.entries()]
      .filter(([k, v]) => k.startsWith(`${uid}#`) && v.entry.date >= from && v.entry.date <= to)
      .map(([, v]) => v.entry)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async latestWeight(uid: string) {
    const all = await this.listWeights(uid, '0000-01-01', '9999-12-31');
    return all.at(-1) ?? null;
  }
  async putWeight(uid: string, entry: WeightEntry, expiresAt: number) {
    this.weights.set(`${uid}#${entry.date}`, { entry, expiresAt });
  }
  async deleteWeight(uid: string, date: IsoDate) {
    this.weights.delete(`${uid}#${date}`);
  }

  async deleteUserData(uid: string) {
    for (const map of [this.entries, this.weights]) {
      for (const k of [...map.keys()]) if (k.startsWith(`${uid}#`)) map.delete(k);
    }
    this.profiles.delete(uid);
  }

  async consumeScanQuota(uid: string, day: IsoDate, limits: ScanLimits) {
    const userKey = `${day}#${uid}`;
    const globalKey = `${day}#GLOBAL`;
    const user = this.scanCounts.get(userKey) ?? 0;
    const all = this.scanCounts.get(globalKey) ?? 0;
    if (user >= limits.perUser || all >= limits.global) return false;
    this.scanCounts.set(userKey, user + 1);
    this.scanCounts.set(globalKey, all + 1);
    return true;
  }
}
