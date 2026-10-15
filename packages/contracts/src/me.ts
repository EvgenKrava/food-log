import { z } from 'zod';
import { DishSchema } from './dish.ts';
import { ProductSchema } from './product.ts';

export const MyItemsResponseSchema = z.object({
  products: z.array(ProductSchema),
  dishes: z.array(DishSchema),
});
