import { z } from 'zod';
import { IsoDateSchema, dateRangeQuerySchema } from './common.ts';
import { NutrientsSchema, TargetsSchema } from './nutrients.ts';

export const StatsQuerySchema = dateRangeQuerySchema(31);

export const DayTotalsSchema = z.object({ date: IsoDateSchema, totals: NutrientsSchema });

export const StatsResponseSchema = z.object({
  days: z.array(DayTotalsSchema),
  targets: TargetsSchema.nullable(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
