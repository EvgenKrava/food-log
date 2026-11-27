import type {
  LabelReading,
  DiaryEntry,
  IsoDate,
  ModerationStatus,
  Nutrients,
  Profile,
  ItemType,
  PhotoUploadResponse,
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
  rejectReason?: string;
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
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
};

/** One person's own photo of a product or dish; lives under USER#<uid>, so deleting their data drops it. */
export type StoredPhoto = { type: ItemType; itemId: string; key: string; updatedAt: string };

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

  /** User-made products and dishes in a shared-catalog status, oldest change first. */
  listCatalog(status: CatalogStatus): Promise<{ products: StoredProduct[]; dishes: StoredDish[] }>;

  listEntries(uid: string, from: IsoDate, to: IsoDate): Promise<DiaryEntry[]>;
  getEntry(uid: string, date: IsoDate, id: string): Promise<DiaryEntry | null>;
  putEntry(uid: string, entry: DiaryEntry, expiresAt: number | undefined): Promise<void>;
  deleteEntry(uid: string, date: IsoDate, id: string): Promise<void>;

  getProfile(uid: string): Promise<Profile | null>;
  putProfile(uid: string, profile: Profile): Promise<void>;

  listWeights(uid: string, from: IsoDate, to: IsoDate): Promise<WeightEntry[]>;
  latestWeight(uid: string): Promise<WeightEntry | null>;
  putWeight(uid: string, entry: WeightEntry, expiresAt: number | undefined): Promise<void>;
  deleteWeight(uid: string, date: IsoDate): Promise<void>;

  listPhotos(uid: string): Promise<StoredPhoto[]>;
  getPhoto(uid: string, type: ItemType, itemId: string): Promise<StoredPhoto | null>;
  putPhoto(uid: string, photo: StoredPhoto): Promise<void>;
  deletePhoto(uid: string, type: ItemType, itemId: string): Promise<void>;

  /** Removes every USER#<uid> item (diary, weight, profile, photo records). */
  deleteUserData(uid: string): Promise<void>;

  /**
   * Atomically counts one scan against the caller's and the service's daily limits.
   * Returns false (and counts nothing) when either limit is already reached.
   */
  consumeScanQuota(uid: string, day: IsoDate, limits: ScanLimits, expiresAt: number): Promise<boolean>;
}

/** Statuses the shared-catalog index tracks: the moderation queue and the public catalog. */
export type CatalogStatus = 'pending' | 'approved';

export type ScanLimits = { perUser: number; global: number };

export type LabelImage = { data: string; mediaType: 'image/jpeg' | 'image/webp' };

/** Reads a nutrition label photo; returns what is printed, unconverted. */
export interface LabelReader {
  read(image: LabelImage): Promise<LabelReading>;
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

/** Where item photos live (S3 in production). Keys are `photos/<uid>/<ulid>.jpg` once attached. */
export interface PhotoStore {
  /** A presigned upload for `uploads/<uid>/<id>.jpg`; unattached uploads expire on their own. */
  presignUpload(uid: string, id: string): Promise<PhotoUploadResponse>;
  /**
   * Moves an upload to its permanent key and returns that key.
   * Throws DomainError NOT_FOUND when nothing was uploaded under `uploadKey`.
   */
  attach(uploadKey: string, uid: string, id: string): Promise<string>;
  remove(key: string): Promise<void>;
  /** Deletes every photo and pending upload of one person. */
  removeAll(uid: string): Promise<void>;
  /** The URL the browser shows the photo from. */
  url(key: string): string;
}

export type Clock = () => Date;
