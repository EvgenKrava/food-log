import type {
  DiaryEntry,
  IsoDate,
  ModerationStatus,
  Nutrients,
  Profile,
  ProductSource,
  WeightEntry,
} from '@foodlog/contracts';

export type StoredProduct = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingSizeG?: number;
  per100g: Nutrients;
  source: ProductSource;
  ownerId?: string;
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoredDish = {
  id: string;
  ownerId?: string;
  name: string;
  ingredients: { productId: string; grams: number; name: string; per100g: Nutrients }[];
  cookedWeightG?: number;
  totals: Nutrients;
  weightG: number;
  per100g: Nutrients;
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string;
};

export interface Repository {
  getDish(id: string): Promise<StoredDish | null>;
  putDish(dish: StoredDish): Promise<void>;
  deleteDish(id: string): Promise<void>;
  listOwnDishes(ownerId: string): Promise<StoredDish[]>;

  getProduct(id: string): Promise<StoredProduct | null>;
  putProduct(product: StoredProduct): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  listOwnProducts(ownerId: string): Promise<StoredProduct[]>;
  findByBarcode(barcode: string): Promise<StoredProduct[]>;

  listEntries(uid: string, from: IsoDate, to: IsoDate): Promise<DiaryEntry[]>;
  getEntry(uid: string, date: IsoDate, id: string): Promise<DiaryEntry | null>;
  putEntry(uid: string, entry: DiaryEntry, expiresAt: number): Promise<void>;
  deleteEntry(uid: string, date: IsoDate, id: string): Promise<void>;

  getProfile(uid: string): Promise<Profile | null>;
  putProfile(uid: string, profile: Profile): Promise<void>;

  listWeights(uid: string, from: IsoDate, to: IsoDate): Promise<WeightEntry[]>;
  latestWeight(uid: string): Promise<WeightEntry | null>;
  putWeight(uid: string, entry: WeightEntry, expiresAt: number): Promise<void>;
  deleteWeight(uid: string, date: IsoDate): Promise<void>;

  /** Removes every USER#<uid> item (diary, weight, profile). */
  deleteUserData(uid: string): Promise<void>;
}

/** A product as Open Food Facts describes it, already validated and converted to per 100 g. */
export type OffProduct = {
  barcode: string;
  name: string;
  brand?: string;
  servingSizeG?: number;
  per100g: Nutrients;
};

export interface FoodFacts {
  search(query: string): Promise<OffProduct[]>;
  byBarcode(barcode: string): Promise<OffProduct | null>;
}

export type Clock = () => Date;
