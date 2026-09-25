import { describe, expect, it } from 'vitest';

import { createExerciseSchema, validateWorkoutSetActuals, validateWorkoutTemplateSetTargets } from './index';
import {
  buildCardioHistoryEntries,
  computeAveragePaceSecondsPerKm,
  computeAverageSpeedKmh,
  formatDistanceMeters,
  formatDuration,
  formatPace,
  kilometersToMeters,
} from './cardio-metrics';

describe('cardio metrics', () => {
  it('formate une durée et une distance', () => {
    expect(formatDuration(2052)).toBe('34:12');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(null)).toBeNull();
    expect(formatDistanceMeters(5200)).toBe('5,2 km');
    expect(formatDistanceMeters(2150)).toBe('2,15 km');
    expect(formatDistanceMeters(800)).toBe('800 m');
    expect(kilometersToMeters(5.2)).toBe(5200);
  });

  it('calcule allure et vitesse, et ignore les zéros', () => {
    expect(computeAveragePaceSecondsPerKm(5000, 32 * 60)).toBeCloseTo(384, 5);
    expect(formatPace(384)).toBe('6:24 /km');
    expect(computeAverageSpeedKmh(5000, 32 * 60)).toBeCloseTo(9.375, 2);
    expect(computeAveragePaceSecondsPerKm(0, 60)).toBeNull();
    expect(computeAverageSpeedKmh(1000, 0)).toBeNull();
    expect(computeAveragePaceSecondsPerKm(null, 60)).toBeNull();
  });

  it('agrège l’historique cardio', () => {
    const entries = buildCardioHistoryEntries([
      {
        workoutSessionId: 's1',
        localDate: '2026-09-28',
        sessionRpe: 8,
        notes: null,
        sets: [
          {
            status: 'COMPLETED',
            actualDurationSeconds: 1440,
            actualDistanceMeters: 2700,
          },
        ],
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.distanceMeters).toBe(2700);
    expect(entries[0]?.sessionRpe).toBe(8);
    expect(entries[0]?.averagePaceSecondsPerKm).toBeCloseTo((1440 / 2700) * 1000, 5);
  });
});

describe('cardio validation', () => {
  it('crée un exercice STRENGTH sans type cardio', () => {
    const parsed = createExerciseSchema.parse({
      name: 'Chest Press',
      primaryMuscleGroupId: '11111111-1111-1111-1111-111111111111',
      measurementType: 'WEIGHT_REPS',
    });
    expect(parsed.category).toBe('STRENGTH');
    expect(parsed.cardioType ?? null).toBeNull();
  });

  it('exige un CardioType pour CARDIO', () => {
    const result = createExerciseSchema.safeParse({
      name: 'Course',
      primaryMuscleGroupId: '11111111-1111-1111-1111-111111111111',
      measurementType: 'DISTANCE_DURATION',
      category: 'CARDIO',
    });
    expect(result.success).toBe(false);
  });

  it('accepte une prescription DURATION, DISTANCE et DISTANCE_DURATION', () => {
    expect(
      validateWorkoutTemplateSetTargets('DURATION', emptyTargets({ targetDurationSeconds: 600 })).ok,
    ).toBe(true);
    expect(
      validateWorkoutTemplateSetTargets('DISTANCE', emptyTargets({ targetDistanceMeters: 2000 })).ok,
    ).toBe(true);
    expect(
      validateWorkoutTemplateSetTargets(
        'DISTANCE_DURATION',
        emptyTargets({ targetDurationSeconds: 1200, targetDistanceMeters: 3000 }),
      ).ok,
    ).toBe(true);
  });

  it('enregistre un résultat cardio et rejette le cardio sur WEIGHT_REPS', () => {
    const saved = validateWorkoutSetActuals('DURATION', {
      status: 'COMPLETED',
      actualWeightKg: null,
      actualReps: null,
      actualDurationSeconds: 600,
      actualDistanceMeters: null,
      averageHeartRate: 150,
      actualRir: null,
      actualRpe: null,
      reachedFailure: false,
      notes: null,
    });
    expect(saved.ok).toBe(true);

    const rejected = validateWorkoutSetActuals('WEIGHT_REPS', {
      status: 'COMPLETED',
      actualWeightKg: 50,
      actualReps: 10,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      averageHeartRate: 140,
      actualRir: null,
      actualRpe: null,
      reachedFailure: false,
      notes: null,
    });
    expect(rejected.ok).toBe(false);
  });

  it('rejette un RPE de séance hors borne via le schéma de fin', async () => {
    const { completeWorkoutSessionSchema } = await import('./index');
    expect(
      completeWorkoutSessionSchema.safeParse({
        expectedVersion: 1,
        sessionRpe: 11,
      }).success,
    ).toBe(false);
    expect(
      completeWorkoutSessionSchema.safeParse({
        expectedVersion: 1,
        sessionRpe: 7,
        notes: 'Jambes lourdes',
      }).success,
    ).toBe(true);
  });
});

function emptyTargets(
  overrides: Partial<{
    targetRepMin: number | null;
    targetRepMax: number | null;
    targetDurationSeconds: number | null;
    targetDistanceMeters: number | null;
    targetWeightKg: number | null;
    targetIntensityPercent: number | null;
    targetRir: number | null;
    targetRpe: number | null;
    restSeconds: number | null;
  }>,
) {
  return {
    targetRepMin: null,
    targetRepMax: null,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: null,
    targetRpe: null,
    restSeconds: null,
    ...overrides,
  };
}
