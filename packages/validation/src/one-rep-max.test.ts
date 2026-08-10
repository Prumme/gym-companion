import { describe, expect, it } from 'vitest';

import {
  MAX_E1RM_REPS,
  MIN_E1RM_REPS,
  ONE_REP_MAX_FORMULA,
  compareEstimatedOneRepMaxCandidates,
  computeBestEstimatedOneRepMaxForWorkout,
  computeExerciseStrengthSummary,
  estimateOneRepMaxEpley,
  isEligibleForEstimatedOneRepMax,
  parseExerciseStrengthQuery,
  type EstimatedOneRepMaxCandidate,
  type StrengthSessionInput,
  type StrengthSetInput,
} from './one-rep-max';

function set(overrides: Partial<StrengthSetInput> = {}): StrengthSetInput {
  return {
    id: 'set-1',
    setType: 'WORKING',
    status: 'COMPLETED',
    position: 0,
    actualWeightKg: 100,
    actualReps: 8,
    actualRir: 1,
    actualRpe: null,
    reachedFailure: false,
    completedAt: '2026-08-01T08:10:00.000Z',
    ...overrides,
  };
}

function session(
  sets: StrengthSetInput[],
  overrides: Partial<StrengthSessionInput> = {},
): StrengthSessionInput {
  return {
    workoutSessionId: 'ws-1',
    sessionStatus: 'COMPLETED',
    localDate: '2026-08-01',
    startedAt: '2026-08-01T08:00:00.000Z',
    exercises: [
      {
        id: 'wse-1',
        sourceExerciseId: 'ex-1',
        measurementType: 'WEIGHT_REPS',
        equipmentTypeId: 'eq-1',
        sets,
      },
    ],
    ...overrides,
  };
}

describe('estimateOneRepMaxEpley', () => {
  it('100 kg × 1 → 100', () => {
    expect(estimateOneRepMaxEpley(100, 1)).toBe(100);
  });

  it('100 kg × 5 → 116.666…', () => {
    expect(estimateOneRepMaxEpley(100, 5)).toBeCloseTo(116.6666667, 5);
  });

  it('100 kg × 8 → 126.666…', () => {
    expect(estimateOneRepMaxEpley(100, 8)).toBeCloseTo(126.6666667, 5);
  });

  it('charge décimale 22.5 × 8', () => {
    expect(estimateOneRepMaxEpley(22.5, 8)).toBeCloseTo(28.5, 5);
  });

  it('12 reps inclus', () => {
    expect(estimateOneRepMaxEpley(100, 12)).toBeCloseTo(140, 5);
  });

  it('0 rep / 13 reps / poids 0 / négatif → null', () => {
    expect(estimateOneRepMaxEpley(100, 0)).toBeNull();
    expect(estimateOneRepMaxEpley(100, 13)).toBeNull();
    expect(estimateOneRepMaxEpley(0, 5)).toBeNull();
    expect(estimateOneRepMaxEpley(-10, 5)).toBeNull();
  });

  it('valeurs non finies → null', () => {
    expect(estimateOneRepMaxEpley(Number.NaN, 5)).toBeNull();
    expect(estimateOneRepMaxEpley(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('isEligibleForEstimatedOneRepMax', () => {
  const base = {
    measurementType: 'WEIGHT_REPS',
    sessionStatus: 'COMPLETED',
    setStatus: 'COMPLETED',
    setType: 'WORKING',
    actualWeightKg: 100,
    actualReps: 8,
    sourceExerciseId: 'ex-1',
  };

  it('accepte WEIGHT_REPS éligible', () => {
    expect(isEligibleForEstimatedOneRepMax(base)).toBe(true);
  });

  it('refuse autre measurementType', () => {
    expect(
      isEligibleForEstimatedOneRepMax({
        ...base,
        measurementType: 'BODYWEIGHT_REPS',
      }),
    ).toBe(false);
  });

  it('refuse PARTIAL / FAILED / SKIPPED / WARMUP', () => {
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, setStatus: 'PARTIAL' }),
    ).toBe(false);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, setStatus: 'FAILED' }),
    ).toBe(false);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, setStatus: 'SKIPPED' }),
    ).toBe(false);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, setType: 'WARMUP' }),
    ).toBe(false);
  });

  it('reps 1 et 12 ok, 13 ko ; weight null ko', () => {
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, actualReps: MIN_E1RM_REPS }),
    ).toBe(true);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, actualReps: MAX_E1RM_REPS }),
    ).toBe(true);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, actualReps: 13 }),
    ).toBe(false);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, actualWeightKg: null }),
    ).toBe(false);
    expect(
      isEligibleForEstimatedOneRepMax({ ...base, actualReps: null }),
    ).toBe(false);
  });
});

describe('computeBestEstimatedOneRepMaxForWorkout', () => {
  it('une série', () => {
    const point = computeBestEstimatedOneRepMaxForWorkout(session([set()]));
    expect(point?.estimatedOneRepMaxKg).toBeCloseTo(126.6666667, 5);
    expect(point?.sourceSet.weightKg).toBe(100);
    expect(point?.sourceSet.reps).toBe(8);
  });

  it('plusieurs séries — meilleure e1RM', () => {
    const point = computeBestEstimatedOneRepMaxForWorkout(
      session([
        set({ id: 'a', actualWeightKg: 100, actualReps: 5, position: 0 }),
        set({ id: 'b', actualWeightKg: 90, actualReps: 10, position: 1 }),
      ]),
    );
    expect(point?.estimatedOneRepMaxKg).toBe(120);
    expect(point?.sourceSet.workoutSetId).toBe('b');
  });

  it('tie-break : même e1RM → poids plus élevé, puis moins de reps', () => {
    const a: EstimatedOneRepMaxCandidate = {
      estimatedOneRepMaxKg: 120,
      formula: ONE_REP_MAX_FORMULA,
      weightKg: 90,
      reps: 10,
      rir: null,
      rpe: null,
      reachedFailure: false,
      setType: 'WORKING',
      position: 0,
      workoutSessionId: 'ws',
      workoutSessionExerciseId: 'wse',
      workoutSetId: 'a',
      localDate: '2026-08-01',
      completedAt: null,
    };
    const b: EstimatedOneRepMaxCandidate = {
      ...a,
      weightKg: 100,
      reps: 6,
      workoutSetId: 'b',
      position: 1,
    };
    expect(compareEstimatedOneRepMaxCandidates(a, b)).toBeGreaterThan(0);

    const point = computeBestEstimatedOneRepMaxForWorkout(
      session([
        set({ id: 'low', actualWeightKg: 90, actualReps: 10, position: 0 }),
        set({ id: 'high', actualWeightKg: 100, actualReps: 6, position: 1 }),
      ]),
    );
    // 90×10 = 120, 100×6 = 120 → tie-break poids DESC → 100
    expect(point?.sourceSet.workoutSetId).toBe('high');
  });

  it('warmup / partial / failed exclus même si e1RM supérieur', () => {
    const point = computeBestEstimatedOneRepMaxForWorkout(
      session([
        set({
          id: 'warmup',
          setType: 'WARMUP',
          actualWeightKg: 140,
          actualReps: 5,
          position: 0,
        }),
        set({
          id: 'partial',
          status: 'PARTIAL',
          actualWeightKg: 130,
          actualReps: 5,
          position: 1,
        }),
        set({
          id: 'failed',
          status: 'FAILED',
          actualWeightKg: 125,
          actualReps: 5,
          position: 2,
        }),
        set({
          id: 'work',
          actualWeightKg: 100,
          actualReps: 5,
          position: 3,
        }),
      ]),
    );
    expect(point?.sourceSet.workoutSetId).toBe('work');
  });

  it('plusieurs occurrences du même exercice', () => {
    const point = computeBestEstimatedOneRepMaxForWorkout({
      workoutSessionId: 'ws-1',
      sessionStatus: 'COMPLETED',
      localDate: '2026-08-01',
      startedAt: '2026-08-01T08:00:00.000Z',
      exercises: [
        {
          id: 'wse-1',
          sourceExerciseId: 'ex-1',
          measurementType: 'WEIGHT_REPS',
          equipmentTypeId: null,
          sets: [set({ id: 's1', actualWeightKg: 80, actualReps: 5 })],
        },
        {
          id: 'wse-2',
          sourceExerciseId: 'ex-1',
          measurementType: 'WEIGHT_REPS',
          equipmentTypeId: null,
          sets: [set({ id: 's2', actualWeightKg: 100, actualReps: 5 })],
        },
      ],
    });
    expect(point?.sourceSet.workoutSetId).toBe('s2');
    expect(point?.workoutSessionExerciseIds).toEqual(['wse-1', 'wse-2']);
  });
});

describe('computeExerciseStrengthSummary', () => {
  it('zéro point', () => {
    const summary = computeExerciseStrengthSummary([]);
    expect(summary.pointCount).toBe(0);
    expect(summary.latestEstimatedOneRepMaxKg).toBeNull();
    expect(summary.absoluteChangeKg).toBeNull();
  });

  it('un point — pas de variation', () => {
    const summary = computeExerciseStrengthSummary([
      {
        workoutSessionId: 'ws-1',
        workoutSessionExerciseIds: ['wse-1'],
        localDate: '2026-08-01',
        startedAt: '2026-08-01T08:00:00.000Z',
        estimatedOneRepMaxKg: 120,
        sourceSet: {
          workoutSessionExerciseId: 'wse-1',
          workoutSetId: 'set-1',
          weightKg: 90,
          reps: 10,
          rir: null,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
    ]);
    expect(summary.pointCount).toBe(1);
    expect(summary.absoluteChangeKg).toBeNull();
    expect(summary.latestSource?.weightKg).toBe(90);
  });

  it('plusieurs points — latest, best ancien, variation', () => {
    const points = [
      {
        workoutSessionId: 'ws-1',
        workoutSessionExerciseIds: ['wse-1'],
        localDate: '2026-07-01',
        startedAt: '2026-07-01T08:00:00.000Z',
        estimatedOneRepMaxKg: 100,
        sourceSet: {
          workoutSessionExerciseId: 'wse-1',
          workoutSetId: 'a',
          weightKg: 100,
          reps: 1,
          rir: null,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
      {
        workoutSessionId: 'ws-2',
        workoutSessionExerciseIds: ['wse-2'],
        localDate: '2026-07-15',
        startedAt: '2026-07-15T08:00:00.000Z',
        estimatedOneRepMaxKg: 131.3333333,
        sourceSet: {
          workoutSessionExerciseId: 'wse-2',
          workoutSetId: 'b',
          weightKg: 105,
          reps: 7,
          rir: null,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
      {
        workoutSessionId: 'ws-3',
        workoutSessionExerciseIds: ['wse-3'],
        localDate: '2026-08-01',
        startedAt: '2026-08-01T08:00:00.000Z',
        estimatedOneRepMaxKg: 120,
        sourceSet: {
          workoutSessionExerciseId: 'wse-3',
          workoutSetId: 'c',
          weightKg: 90,
          reps: 10,
          rir: 2,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
    ];

    const summary = computeExerciseStrengthSummary(points);
    expect(summary.firstEstimatedOneRepMaxKg).toBe(100);
    expect(summary.latestEstimatedOneRepMaxKg).toBe(120);
    expect(summary.bestEstimatedOneRepMaxKg).toBeCloseTo(131.3333333, 5);
    expect(summary.bestDate).toBe('2026-07-15');
    expect(summary.absoluteChangeKg).toBe(20);
    expect(summary.percentageChange).toBe(20);
    expect(summary.latestSource?.rir).toBe(2);
  });

  it('variation négative et first=0 défensif', () => {
    const summary = computeExerciseStrengthSummary([
      {
        workoutSessionId: 'ws-1',
        workoutSessionExerciseIds: ['wse-1'],
        localDate: '2026-07-01',
        startedAt: '2026-07-01T08:00:00.000Z',
        estimatedOneRepMaxKg: 0,
        sourceSet: {
          workoutSessionExerciseId: 'wse-1',
          workoutSetId: 'a',
          weightKg: 0,
          reps: 1,
          rir: null,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
      {
        workoutSessionId: 'ws-2',
        workoutSessionExerciseIds: ['wse-2'],
        localDate: '2026-08-01',
        startedAt: '2026-08-01T08:00:00.000Z',
        estimatedOneRepMaxKg: 100,
        sourceSet: {
          workoutSessionExerciseId: 'wse-2',
          workoutSetId: 'b',
          weightKg: 100,
          reps: 1,
          rir: null,
          rpe: null,
          reachedFailure: false,
          setType: 'WORKING',
        },
      },
    ]);
    expect(summary.absoluteChangeKg).toBe(100);
    expect(summary.percentageChange).toBeNull();
  });
});

describe('parseExerciseStrengthQuery', () => {
  it('accepte from/to cohérents', () => {
    const result = parseExerciseStrengthQuery({
      from: '2026-01-01',
      to: '2026-08-01',
    });
    expect(result.ok).toBe(true);
  });

  it('refuse période inversée', () => {
    const result = parseExerciseStrengthQuery({
      from: '2026-08-01',
      to: '2026-01-01',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STRENGTH_INVALID_DATE_RANGE');
    }
  });

  it('refuse date invalide', () => {
    const result = parseExerciseStrengthQuery({ from: 'not-a-date' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STRENGTH_INVALID_FROM_DATE');
    }
  });
});
