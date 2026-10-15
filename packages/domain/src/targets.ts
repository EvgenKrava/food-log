import type { Activity, Goal, Sex, Targets } from '@foodlog/contracts';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_FACTORS: Record<Goal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };

export const PROTEIN_G_PER_KG = 1.6;
export const FAT_SHARE_OF_KCAL = 0.25;

export type TargetInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  currentYear: number;
};

export function basalMetabolicRate(
  input: Pick<TargetInput, 'sex' | 'birthYear' | 'heightCm' | 'weightKg' | 'currentYear'>,
): number {
  const age = input.currentYear - input.birthYear;
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * age + (input.sex === 'male' ? 5 : -161);
}

export function splitMacros(kcal: number, weightKg: number): Targets {
  const protein = Math.round(PROTEIN_G_PER_KG * weightKg);
  const fat = Math.round((FAT_SHARE_OF_KCAL * kcal) / 9);
  const carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
  return { kcal, protein, fat, carbs };
}

export function computeTargets(input: TargetInput): Targets {
  const kcal = Math.round(
    basalMetabolicRate(input) * ACTIVITY_FACTORS[input.activity] * GOAL_FACTORS[input.goal],
  );
  return splitMacros(kcal, input.weightKg);
}
