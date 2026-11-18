import { z } from 'zod';

export const UPGRADE_URL = 'https://onlytools.click/plus/';

export type Plan = 'free' | 'plus';

const perPlan = z.object({ free: z.number().int().positive().nullable(), plus: z.number().int().positive().nullable() });

// The shape the payments service publishes to SSM /onlytools/plans/limits (null = unlimited).
const PlanLimitsSchema = z.object({
  plusGroup: z.string().min(1),
  apps: z.object({
    foodlog: z.object({ labelScansPerDay: perPlan, historyDays: perPlan }),
  }),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

/** Used until the parameter exists or when it cannot be read: the approved Free/Plus numbers. */
export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  plusGroup: 'plus',
  apps: {
    foodlog: {
      labelScansPerDay: { free: 3, plus: 50 },
      historyDays: { free: 90, plus: null },
    },
  },
};

export type FoodlogLimits = { plan: Plan; labelScansPerDay: number | null; historyDays: number | null };

export function limitsFor(groups: readonly string[], limits: PlanLimits): FoodlogLimits {
  const plan: Plan = groups.includes(limits.plusGroup) ? 'plus' : 'free';
  const app = limits.apps.foodlog;
  return { plan, labelScansPerDay: app.labelScansPerDay[plan], historyDays: app.historyDays[plan] };
}

export function parsePlanLimits(raw: string): PlanLimits {
  return PlanLimitsSchema.parse(JSON.parse(raw));
}

/**
 * Reads the limits once per cold start. A missing or malformed parameter falls back to the
 * defaults rather than breaking the API.
 */
export function cachedPlanLimits(read: () => Promise<string | undefined>): () => Promise<PlanLimits> {
  let loaded: Promise<PlanLimits> | undefined;
  return () =>
    (loaded ??= read().then(
      (raw) => (raw === undefined ? DEFAULT_PLAN_LIMITS : parsePlanLimits(raw)),
      (err: unknown) => {
        console.warn('plan limits unavailable, using defaults', err);
        return DEFAULT_PLAN_LIMITS;
      },
    ).catch((err: unknown) => {
      console.warn('plan limits malformed, using defaults', err);
      return DEFAULT_PLAN_LIMITS;
    }));
}
