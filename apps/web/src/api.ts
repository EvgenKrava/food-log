import { tr } from './i18n';
import type {
  CatalogItem,
  CreateDiaryEntryRequest,
  CreateProductRequest,
  ScanImageRequest,
  ScanResponse,
  DiaryDay,
  DiaryEntry,
  CreateDishRequest,
  Dish,
  UpdateDishRequest,
  Product,
  ProfileResponse,
  PutProfileRequest,
  StatsResponse,
  UpdateDiaryEntryRequest,
  WeightEntry,
} from '@foodlog/contracts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type TokenSource = { token: () => Promise<string | null>; onUnauthorized: () => void };
let tokens: TokenSource = { token: async () => null, onUnauthorized: () => undefined };
export const setTokenSource = (t: TokenSource) => {
  tokens = t;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await tokens.token();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.status === 401) tokens.onUnauthorized();
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'INTERNAL', data?.error?.message ?? tr('Помилка сервера'));
  }
  return data as T;
}

export type Me = { email: string; hasAccess: boolean; isAdmin: boolean };

export const api = {
  me: () => request<Me>('GET', '/me'),
  day: (date: string) => request<DiaryDay>('GET', `/diary/${date}`),
  addEntry: (date: string, body: CreateDiaryEntryRequest) =>
    request<DiaryEntry>('POST', `/diary/${date}/entries`, body),
  updateEntry: (date: string, id: string, body: UpdateDiaryEntryRequest) =>
    request<DiaryEntry>('PATCH', `/diary/${date}/entries/${id}`, body),
  deleteEntry: (date: string, id: string) => request<undefined>('DELETE', `/diary/${date}/entries/${id}`),
  search: (q: string) => request<{ items: CatalogItem[] }>('GET', `/search?q=${encodeURIComponent(q)}`),
  product: (id: string) => request<Product>('GET', `/products/${id}`),
  barcode: (ean: string) => request<Product>('GET', `/products/barcode/${ean}`),
  createProduct: (body: CreateProductRequest) => request<Product>('POST', '/products', body),
  scanLabel: (body: ScanImageRequest) => request<ScanResponse>('POST', '/scans', body),
  deleteProduct: (id: string) => request<undefined>('DELETE', `/products/${id}`),
  myItems: () => request<{ products: Product[]; dishes: Dish[] }>('GET', '/me/items'),
  dish: (id: string) => request<Dish>('GET', `/dishes/${id}`),
  createDish: (body: CreateDishRequest) => request<Dish>('POST', '/dishes', body),
  updateDish: (id: string, body: UpdateDishRequest) => request<Dish>('PUT', `/dishes/${id}`, body),
  deleteDish: (id: string) => request<undefined>('DELETE', `/dishes/${id}`),
  profile: () => request<ProfileResponse>('GET', '/profile'),
  putProfile: (body: PutProfileRequest) => request<unknown>('PUT', '/profile', body),
  putWeight: (date: string, kg: number) => request<WeightEntry>('PUT', `/weight/${date}`, { kg }),
  weights: (from: string, to: string) =>
    request<{ entries: WeightEntry[] }>('GET', `/weight?from=${from}&to=${to}`),
  stats: (from: string, to: string) => request<StatsResponse>('GET', `/stats?from=${from}&to=${to}`),
  deleteMyData: () => request<undefined>('DELETE', '/me'),
};
