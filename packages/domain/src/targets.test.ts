import { describe, expect, it } from 'vitest';
import { basalMetabolicRate, computeTargets, splitMacros } from './targets.ts';

const currentYear = 2026;

describe('basalMetabolicRate', () => {
  it('applies Mifflin–St Jeor for men and women', () => {
    expect(
      basalMetabolicRate({
        sex: 'male',
        birthYear: 1996,
        heightCm: 180,
        weightKg: 80,
        currentYear,
      }),
    ).toBeCloseTo(1780, 6);
    expect(
      basalMetabolicRate({
        sex: 'female',
        birthYear: 2001,
        heightCm: 165,
        weightKg: 60,
        currentYear,
      }),
    ).toBeCloseTo(1345.25, 6);
  });
});

describe('computeTargets', () => {
  it('maintains a moderately active man', () => {
    expect(
      computeTargets({
        sex: 'male',
        birthYear: 1996,
        heightCm: 180,
        weightKg: 80,
        activity: 'moderate',
        goal: 'maintain',
        currentYear,
      }),
    ).toEqual({ kcal: 2759, protein: 128, fat: 77, carbs: 389 });
  });

  it('applies a 15% deficit for a sedentary woman losing weight', () => {
    expect(
      computeTargets({
        sex: 'female',
        birthYear: 2001,
        heightCm: 165,
        weightKg: 60,
        activity: 'sedentary',
        goal: 'lose',
        currentYear,
      }),
    ).toEqual({ kcal: 1372, protein: 96, fat: 38, carbs: 162 });
  });

  it('applies a 10% surplus for a very active man gaining weight', () => {
    expect(
      computeTargets({
        sex: 'male',
        birthYear: 1986,
        heightCm: 175,
        weightKg: 90,
        activity: 'very_active',
        goal: 'gain',
        currentYear,
      }),
    ).toEqual({ kcal: 3759, protein: 144, fat: 104, carbs: 562 });
  });
});

describe('splitMacros', () => {
  it('never returns negative carbs', () => {
    expect(splitMacros(1000, 200)).toEqual({ kcal: 1000, protein: 320, fat: 28, carbs: 0 });
  });
});
