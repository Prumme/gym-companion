import { describe, expect, it } from 'vitest';

import {
  compareExerciseProgressPointsAsc,
  computeExerciseProgressSummary,
  computeExerciseWorkoutProgressPoint,
  excludesWarmupFromProgressMetric,
  parseExerciseProgressQuery,
  resolveAvailableProgressMetrics,
  resolveDefaultProgressMetric,
  type ExerciseProgressSessionInput,
  type ExerciseProgressSetInput,
} from './exercise-progress';

function set(
  overrides: Partial<ExerciseProgressSetInput> = {},
): ExerciseProgressSetInput {
  return {
    id: 'set-1',
    setType: 'WORKING',
    status: 'COMPLETED',
    actualWeightKg: 100,
    actualReps: 8,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    ...overrides,
  };
}

function weightSession(
  sets: ExerciseProgressSetInput[],
  overrides: Partial<ExerciseProgressSessionInput> = {},
): ExerciseProgressSessionInput {
  return {
    workoutSessionId: 'ws-1',
    localDate: '2026-08-01',
    startedAt: '2026-08-01T08:00:00.000Z',
    exercises: [
      {
        id: 'wse-1',
        measurementType: 'WEIGHT_REPS',
        equipmentTypeId: 'eq-1',
        equipmentNameSnapshot: 'Barre',
        sets,
      },
    ],
    ...overrides,
  };
}

describe('resolveAvailableProgressMetrics', () => {
  it('WEIGHT_REPS', () => {
    expect(resolveAvailableProgressMetrics('WEIGHT_REPS')).toEqual([
      'MAX_WEIGHT',
      'MAX_REPS',
      'WORKING_EXTERNAL_VOLUME',
      'TOTAL_REPS',
    ]);
  });

  it('BODYWEIGHT / ASSISTED / REPS_ONLY', () => {
    expect(resolveAvailableProgressMetrics('BODYWEIGHT_REPS')).toEqual([
      'MAX_REPS',
      'TOTAL_REPS',
    ]);
    expect(resolveAvailableProgressMetrics('ASSISTED_BODYWEIGHT_REPS')).toEqual([
      'MAX_REPS',
      'TOTAL_REPS',
    ]);
    expect(resolveAvailableProgressMetrics('REPS_ONLY')).toEqual([
      'MAX_REPS',
      'TOTAL_REPS',
    ]);
  });

  it('DURATION', () => {
    expect(resolveAvailableProgressMetrics('DURATION')).toEqual([
      'MAX_DURATION',
      'TOTAL_DURATION',
    ]);
  });

  it('DISTANCE_DURATION', () => {
    expect(resolveAvailableProgressMetrics('DISTANCE_DURATION')).toEqual([
      'MAX_DISTANCE',
      'TOTAL_DISTANCE',
      'MAX_DURATION',
      'TOTAL_DURATION',
    ]);
  });

  it('WEIGHT_DURATION', () => {
    expect(resolveAvailableProgressMetrics('WEIGHT_DURATION')).toEqual([
      'MAX_WEIGHT',
      'MAX_DURATION',
      'TOTAL_DURATION',
    ]);
  });
});

describe('resolveDefaultProgressMetric', () => {
  it('mappe chaque type', () => {
    expect(resolveDefaultProgressMetric('WEIGHT_REPS')).toBe('MAX_WEIGHT');
    expect(resolveDefaultProgressMetric('BODYWEIGHT_REPS')).toBe('MAX_REPS');
    expect(resolveDefaultProgressMetric('ASSISTED_BODYWEIGHT_REPS')).toBe(
      'MAX_REPS',
    );
    expect(resolveDefaultProgressMetric('REPS_ONLY')).toBe('MAX_REPS');
    expect(resolveDefaultProgressMetric('DURATION')).toBe('MAX_DURATION');
    expect(resolveDefaultProgressMetric('DISTANCE_DURATION')).toBe(
      'MAX_DISTANCE',
    );
    expect(resolveDefaultProgressMetric('WEIGHT_DURATION')).toBe('MAX_WEIGHT');
  });
});

describe('excludesWarmupFromProgressMetric', () => {
  it('exclut les métriques principales', () => {
    expect(excludesWarmupFromProgressMetric('MAX_WEIGHT')).toBe(true);
    expect(excludesWarmupFromProgressMetric('MAX_REPS')).toBe(true);
    expect(excludesWarmupFromProgressMetric('WORKING_EXTERNAL_VOLUME')).toBe(
      true,
    );
    expect(excludesWarmupFromProgressMetric('TOTAL_REPS')).toBe(false);
    expect(excludesWarmupFromProgressMetric('TOTAL_DURATION')).toBe(false);
    expect(excludesWarmupFromProgressMetric('TOTAL_DISTANCE')).toBe(false);
  });
});

describe('computeExerciseWorkoutProgressPoint — WEIGHT_REPS', () => {
  it('MAX_WEIGHT ignore warmup et SKIPPED', () => {
    const point = computeExerciseWorkoutProgressPoint(
      weightSession([
        set({
          id: 'wu',
          setType: 'WARMUP',
          actualWeightKg: 120,
          actualReps: 5,
        }),
        set({ id: 'w1', actualWeightKg: 100, actualReps: 8 }),
        set({
          id: 'skip',
          status: 'SKIPPED',
          actualWeightKg: null,
          actualReps: null,
        }),
      ]),
      'MAX_WEIGHT',
    );
    expect(point?.value).toBe(100);
  });

  it('MAX_WEIGHT accepte PARTIAL et FAILED', () => {
    const point = computeExerciseWorkoutProgressPoint(
      weightSession([
        set({
          id: 'p',
          status: 'PARTIAL',
          actualWeightKg: 105,
          actualReps: 3,
        }),
        set({
          id: 'f',
          status: 'FAILED',
          actualWeightKg: 110,
          actualReps: 1,
        }),
      ]),
      'MAX_WEIGHT',
    );
    expect(point?.value).toBe(110);
  });

  it('MAX_REPS avec tie-break charge', () => {
    const point = computeExerciseWorkoutProgressPoint(
      weightSession([
        set({ id: 'a', actualWeightKg: 90, actualReps: 10 }),
        set({ id: 'b', actualWeightKg: 100, actualReps: 10 }),
      ]),
      'MAX_REPS',
    );
    expect(point?.value).toBe(10);
    expect(point?.context.maxWeightKg).toBe(100);
  });

  it('WORKING_EXTERNAL_VOLUME exclut warmup', () => {
    const point = computeExerciseWorkoutProgressPoint(
      weightSession([
        set({
          id: 'wu',
          setType: 'WARMUP',
          actualWeightKg: 40,
          actualReps: 10,
        }),
        set({ id: 'w1', actualWeightKg: 100, actualReps: 5 }),
        set({ id: 'w2', actualWeightKg: 100, actualReps: 5 }),
      ]),
      'WORKING_EXTERNAL_VOLUME',
    );
    expect(point?.value).toBe(1000);
  });

  it('TOTAL_REPS inclut warmup', () => {
    const point = computeExerciseWorkoutProgressPoint(
      weightSession([
        set({
          id: 'wu',
          setType: 'WARMUP',
          actualWeightKg: 40,
          actualReps: 10,
        }),
        set({ id: 'w1', actualWeightKg: 100, actualReps: 5 }),
      ]),
      'TOTAL_REPS',
    );
    expect(point?.value).toBe(15);
  });

  it('métrique incompatible → null', () => {
    expect(
      computeExerciseWorkoutProgressPoint(
        weightSession([set()]),
        'MAX_DISTANCE',
      ),
    ).toBeNull();
  });
});

describe('BODYWEIGHT / REPS_ONLY', () => {
  it('MAX_REPS et TOTAL_REPS', () => {
    const session: ExerciseProgressSessionInput = {
      workoutSessionId: 'ws-bw',
      localDate: '2026-08-02',
      startedAt: '2026-08-02T08:00:00.000Z',
      exercises: [
        {
          id: 'wse-bw',
          measurementType: 'BODYWEIGHT_REPS',
          equipmentTypeId: null,
          equipmentNameSnapshot: null,
          sets: [
            set({
              id: '1',
              actualWeightKg: null,
              actualReps: 12,
            }),
            set({
              id: '2',
              setType: 'WARMUP',
              actualWeightKg: null,
              actualReps: 20,
            }),
          ],
        },
      ],
    };
    expect(computeExerciseWorkoutProgressPoint(session, 'MAX_REPS')?.value).toBe(
      12,
    );
    expect(
      computeExerciseWorkoutProgressPoint(session, 'TOTAL_REPS')?.value,
    ).toBe(32);
  });
});

describe('DURATION', () => {
  it('max et total', () => {
    const session: ExerciseProgressSessionInput = {
      workoutSessionId: 'ws-d',
      localDate: '2026-08-03',
      startedAt: '2026-08-03T08:00:00.000Z',
      exercises: [
        {
          id: 'wse-d',
          measurementType: 'DURATION',
          equipmentTypeId: null,
          equipmentNameSnapshot: null,
          sets: [
            set({
              id: '1',
              actualWeightKg: null,
              actualReps: null,
              actualDurationSeconds: 40,
            }),
            set({
              id: '2',
              actualWeightKg: null,
              actualReps: null,
              actualDurationSeconds: 60,
            }),
          ],
        },
      ],
    };
    expect(
      computeExerciseWorkoutProgressPoint(session, 'MAX_DURATION')?.value,
    ).toBe(60);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'TOTAL_DURATION')?.value,
    ).toBe(100);
  });
});

describe('DISTANCE_DURATION', () => {
  it('distance et durée', () => {
    const session: ExerciseProgressSessionInput = {
      workoutSessionId: 'ws-dd',
      localDate: '2026-08-04',
      startedAt: '2026-08-04T08:00:00.000Z',
      exercises: [
        {
          id: 'wse-dd',
          measurementType: 'DISTANCE_DURATION',
          equipmentTypeId: null,
          equipmentNameSnapshot: null,
          sets: [
            set({
              id: '1',
              actualWeightKg: null,
              actualReps: null,
              actualDistanceMeters: 1000,
              actualDurationSeconds: 300,
            }),
            set({
              id: '2',
              actualWeightKg: null,
              actualReps: null,
              actualDistanceMeters: 500,
              actualDurationSeconds: 120,
            }),
          ],
        },
      ],
    };
    expect(
      computeExerciseWorkoutProgressPoint(session, 'MAX_DISTANCE')?.value,
    ).toBe(1000);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'TOTAL_DISTANCE')?.value,
    ).toBe(1500);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'MAX_DURATION')?.value,
    ).toBe(300);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'TOTAL_DURATION')?.value,
    ).toBe(420);
  });
});

describe('WEIGHT_DURATION', () => {
  it('poids et durée', () => {
    const session: ExerciseProgressSessionInput = {
      workoutSessionId: 'ws-wd',
      localDate: '2026-08-05',
      startedAt: '2026-08-05T08:00:00.000Z',
      exercises: [
        {
          id: 'wse-wd',
          measurementType: 'WEIGHT_DURATION',
          equipmentTypeId: null,
          equipmentNameSnapshot: null,
          sets: [
            set({
              id: '1',
              actualWeightKg: 20,
              actualReps: null,
              actualDurationSeconds: 45,
            }),
            set({
              id: '2',
              actualWeightKg: 25,
              actualReps: null,
              actualDurationSeconds: 30,
            }),
          ],
        },
      ],
    };
    expect(
      computeExerciseWorkoutProgressPoint(session, 'MAX_WEIGHT')?.value,
    ).toBe(25);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'MAX_DURATION')?.value,
    ).toBe(45);
    expect(
      computeExerciseWorkoutProgressPoint(session, 'TOTAL_DURATION')?.value,
    ).toBe(75);
  });
});

describe('computeExerciseProgressSummary', () => {
  it('zéro point', () => {
    const summary = computeExerciseProgressSummary([], 'MAX_WEIGHT');
    expect(summary.pointCount).toBe(0);
    expect(summary.firstValue).toBeNull();
    expect(summary.percentageChange).toBeNull();
  });

  it('un point — pas de variation', () => {
    const summary = computeExerciseProgressSummary(
      [{ value: 100, localDate: '2026-08-01' }],
      'MAX_WEIGHT',
    );
    expect(summary.pointCount).toBe(1);
    expect(summary.absoluteChange).toBeNull();
    expect(summary.percentageChange).toBeNull();
    expect(summary.bestValue).toBe(100);
  });

  it('variation positive et best', () => {
    const summary = computeExerciseProgressSummary(
      [
        { value: 90, localDate: '2026-07-01' },
        { value: 105, localDate: '2026-07-15' },
        { value: 100, localDate: '2026-08-01' },
      ],
      'MAX_WEIGHT',
    );
    expect(summary.firstValue).toBe(90);
    expect(summary.latestValue).toBe(100);
    expect(summary.bestValue).toBe(105);
    expect(summary.bestDate).toBe('2026-07-15');
    expect(summary.absoluteChange).toBe(10);
    expect(summary.percentageChange).toBeCloseTo(11.1, 1);
  });

  it('variation négative', () => {
    const summary = computeExerciseProgressSummary(
      [
        { value: 100, localDate: '2026-07-01' },
        { value: 90, localDate: '2026-08-01' },
      ],
      'MAX_WEIGHT',
    );
    expect(summary.absoluteChange).toBe(-10);
    expect(summary.percentageChange).toBe(-10);
  });

  it('première valeur zéro → percentageChange null', () => {
    const summary = computeExerciseProgressSummary(
      [
        { value: 0, localDate: '2026-07-01' },
        { value: 10, localDate: '2026-08-01' },
      ],
      'TOTAL_REPS',
    );
    expect(summary.absoluteChange).toBe(10);
    expect(summary.percentageChange).toBeNull();
  });
});

describe('compareExerciseProgressPointsAsc', () => {
  it('trie localDate puis startedAt puis id', () => {
    const a = {
      localDate: '2026-08-01',
      startedAt: '2026-08-01T10:00:00.000Z',
      workoutSessionId: 'b',
    };
    const b = {
      localDate: '2026-08-01',
      startedAt: '2026-08-01T09:00:00.000Z',
      workoutSessionId: 'a',
    };
    expect(compareExerciseProgressPointsAsc(b, a)).toBeLessThan(0);
  });
});

describe('parseExerciseProgressQuery', () => {
  it('accepte from/to inclusifs', () => {
    const result = parseExerciseProgressQuery({
      metric: 'MAX_WEIGHT',
      from: '2026-05-01',
      to: '2026-08-01',
    });
    expect(result.ok).toBe(true);
  });

  it('rejette plage inversée', () => {
    const result = parseExerciseProgressQuery({
      from: '2026-08-01',
      to: '2026-05-01',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PROGRESS_INVALID_DATE_RANGE');
    }
  });

  it('rejette métrique invalide', () => {
    const result = parseExerciseProgressQuery({ metric: 'EPLEY' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PROGRESS_INVALID_METRIC');
    }
  });

  it('objet strict — pas de userId', () => {
    const result = parseExerciseProgressQuery({ userId: 'x' });
    expect(result.ok).toBe(false);
  });
});
