import { z } from 'zod';
import { ManualTargetsSchema, TargetsSchema } from './nutrients.ts';

export const SexSchema = z.enum(['male', 'female']);
export type Sex = z.infer<typeof SexSchema>;

export const ActivitySchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export type Activity = z.infer<typeof ActivitySchema>;

export const GoalSchema = z.enum(['lose', 'maintain', 'gain']);
export type Goal = z.infer<typeof GoalSchema>;

export const LocaleSchema = z.enum(['uk', 'en', 'ru']);
export type Locale = z.infer<typeof LocaleSchema>;

export const AGE_MIN = 13;
export const AGE_MAX = 100;

const BirthYearSchema = z
  .number()
  .int()
  .refine(
    (year) => {
      const age = new Date().getUTCFullYear() - year;
      return age >= AGE_MIN && age <= AGE_MAX;
    },
    { message: `age must be between ${AGE_MIN} and ${AGE_MAX}` },
  );

export const BodyParamsSchema = z.object({
  sex: SexSchema,
  birthYear: BirthYearSchema,
  heightCm: z.number().min(100).max(250),
  activity: ActivitySchema,
  goal: GoalSchema,
});

export const PutProfileRequestSchema = BodyParamsSchema.extend({
  locale: LocaleSchema,
  targetsManual: z.boolean(),
  targets: ManualTargetsSchema.optional(),
}).refine((p) => !p.targetsManual || p.targets !== undefined, {
  message: 'targets are required when targetsManual is true',
  path: ['targets'],
});
export type PutProfileRequest = z.infer<typeof PutProfileRequestSchema>;

export const ProfileSchema = BodyParamsSchema.extend({
  locale: LocaleSchema,
  targetsManual: z.boolean(),
  targets: TargetsSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileResponseSchema = z.object({
  profile: ProfileSchema.nullable(),
  currentWeightKg: z.number().nullable(),
  suggestedTargets: TargetsSchema.nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
