import { z } from 'zod';
import { IsoDateSchema, dateRangeQuerySchema } from './common.ts';

export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 400;

export const PutWeightRequestSchema = z.object({
  kg: z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX),
});

export const WeightEntrySchema = z.object({ date: IsoDateSchema, kg: z.number() });
export type WeightEntry = z.infer<typeof WeightEntrySchema>;

export const WeightQuerySchema = dateRangeQuerySchema(366);

export const WeightListResponseSchema = z.object({ entries: z.array(WeightEntrySchema) });
