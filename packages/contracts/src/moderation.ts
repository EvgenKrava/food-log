import { z } from 'zod';
import { DishSchema } from './dish.ts';
import { ProductSchema } from './product.ts';

export const RejectRequestSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const ModerationQueueItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('product'),
    product: ProductSchema,
    isRevision: z.boolean(),
    kcalMismatch: z.boolean(),
    photoUrl: z.url().nullable(),
    duplicate: ProductSchema.nullable(),
  }),
  z.object({
    type: z.literal('dish'),
    dish: DishSchema,
    isRevision: z.boolean(),
    kcalMismatch: z.boolean(),
  }),
]);

export const ModerationQueueResponseSchema = z.object({
  items: z.array(ModerationQueueItemSchema),
});
