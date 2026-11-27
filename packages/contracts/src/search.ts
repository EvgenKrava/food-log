import { z } from 'zod';
import { ItemTypeSchema, ModerationStatusSchema, ProductSourceSchema } from './common.ts';
import { NutrientsSchema } from './nutrients.ts';

export const SEARCH_QUERY_MAX = 100;

export const SearchQuerySchema = z.object({
  q: z.string().max(SEARCH_QUERY_MAX).default(''),
  type: z.enum(['all', 'product', 'dish']).default('all'),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// One row in search results, favorites and recents.
export const CatalogItemSchema = z.object({
  type: ItemTypeSchema,
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  /** Weight of one serving or piece, so the add sheet can offer it as a one-tap amount. */
  servingSizeG: z.number().positive().optional(),
  per100g: NutrientsSchema,
  source: ProductSourceSchema,
  status: ModerationStatusSchema,
  isOwn: z.boolean(),
  isFavorite: z.boolean(),
  /** The caller's own photo of this item, if they added one. */
  photoUrl: z.url().optional(),
});
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const CatalogListResponseSchema = z.object({ items: z.array(CatalogItemSchema) });
