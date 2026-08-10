import { describe, expect, it } from 'vitest';

import {
  computeElapsedDurationSeconds,
  computeWorkoutMetrics,
  resolveOfficialWorkoutMetrics,
  setExternalVolumeContributionKg,
  type WorkoutMetricsSessionInput,
} from './workout-metrics';

function session(
  overrides: Partial<WorkoutMetricsSessionInput> & {
    exercises: WorkoutMetricsSessionInput['exercises'];
  },
): WorkoutMetricsSessionInput {
  return {
    startedAt: '2026-08-10T08:00:00.000Z',
    completedAt: '2026-08-10T09:12:00.000Z',
    ...overrides,
  };
}

function weightSet(
  overrides: Partial<WorkoutMetricsSessionInput['exercises'][0]['sets'][0]> = {},
) {
  return {
    setType: 'WORKING',
    status: 'COMPLETED',
    actualWeightKg: 60,
    actualReps: 10,
    actualDurationSeconds: null,
    actualDistanceMeters: null,
    reachedFailure: false,
    ...overrides,
  };
}

describe('computeWorkoutMetrics — compteurs', () => {
  it('séance sans résultats', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [weightSet({ status: 'PENDING', actualWeightKg: null, actualReps: null })],
          },
        ],
      }),
    );
    expect(metrics.sets.pending).toBe(1);
    expect(metrics.sets.performed).toBe(0);
    expect(metrics.performedExerciseCount).toBe(0);
    expect(metrics.performance.totalReps).toBe(0);
  });

  it('compte COMPLETED / PARTIAL / FAILED / SKIPPED / PENDING / CANCELLED', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({ status: 'COMPLETED' }),
              weightSet({ status: 'PARTIAL', actualReps: 5 }),
              weightSet({ status: 'FAILED', actualReps: 2 }),
              weightSet({
                status: 'SKIPPED',
                actualWeightKg: null,
                actualReps: null,
              }),
              weightSet({
                status: 'PENDING',
                actualWeightKg: null,
                actualReps: null,
              }),
              weightSet({
                status: 'CANCELLED',
                actualWeightKg: null,
                actualReps: null,
              }),
            ],
          },
        ],
      }),
    );
    expect(metrics.sets.completed).toBe(1);
    expect(metrics.sets.partial).toBe(1);
    expect(metrics.sets.failed).toBe(1);
    expect(metrics.sets.skipped).toBe(1);
    expect(metrics.sets.pending).toBe(1);
    expect(metrics.sets.cancelled).toBe(1);
    expect(metrics.sets.performed).toBe(3);
    expect(metrics.sets.processed).toBe(5);
  });

  it('distingue warmup et working', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({ setType: 'WARMUP', actualWeightKg: 40, actualReps: 8 }),
              weightSet({ setType: 'WORKING' }),
            ],
          },
        ],
      }),
    );
    expect(metrics.sets.warmup).toBe(1);
    expect(metrics.sets.working).toBe(1);
  });
});

describe('computeWorkoutMetrics — exercices / reps', () => {
  it('compte un exercice réalisé', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [weightSet({ status: 'PENDING', actualReps: null })],
          },
          {
            measurementType: 'BODYWEIGHT_REPS',
            sets: [
              weightSet({
                actualWeightKg: null,
                actualReps: 12,
              }),
            ],
          },
        ],
      }),
    );
    expect(metrics.exerciseCount).toBe(2);
    expect(metrics.performedExerciseCount).toBe(1);
    expect(metrics.performance.totalReps).toBe(12);
  });

  it('agrège les reps WEIGHT / BODYWEIGHT / ASSISTED / REPS_ONLY', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [weightSet({ actualReps: 8 })],
          },
          {
            measurementType: 'BODYWEIGHT_REPS',
            sets: [weightSet({ actualWeightKg: null, actualReps: 10 })],
          },
          {
            measurementType: 'ASSISTED_BODYWEIGHT_REPS',
            sets: [weightSet({ actualWeightKg: 20, actualReps: 6 })],
          },
          {
            measurementType: 'REPS_ONLY',
            sets: [weightSet({ actualWeightKg: null, actualReps: 15 })],
          },
        ],
      }),
    );
    expect(metrics.performance.totalReps).toBe(39);
  });

  it('ignore actualReps null', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [weightSet({ actualReps: null })],
          },
        ],
      }),
    );
    expect(metrics.performance.totalReps).toBe(0);
  });
});

describe('computeWorkoutMetrics — volume', () => {
  it('calcule WEIGHT_REPS avec décimales', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [weightSet({ actualWeightKg: 62.5, actualReps: 8 })],
          },
        ],
      }),
    );
    expect(metrics.performance.workingExternalVolumeKg).toBe(500);
    expect(metrics.performance.totalExternalVolumeKg).toBe(500);
  });

  it('inclut warmup dans total et l’exclut de working', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({
                setType: 'WARMUP',
                actualWeightKg: 40,
                actualReps: 10,
              }),
              weightSet({ actualWeightKg: 100, actualReps: 5 }),
            ],
          },
        ],
      }),
    );
    expect(metrics.performance.totalExternalVolumeKg).toBe(900);
    expect(metrics.performance.workingExternalVolumeKg).toBe(500);
  });

  it('PARTIAL et FAILED contribuent avec valeurs réelles', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({ status: 'PARTIAL', actualWeightKg: 80, actualReps: 4 }),
              weightSet({ status: 'FAILED', actualWeightKg: 100, actualReps: 3 }),
            ],
          },
        ],
      }),
    );
    expect(metrics.performance.workingExternalVolumeKg).toBe(620);
  });

  it('exclut BODYWEIGHT / ASSISTED / WEIGHT_DURATION du volume', () => {
    expect(
      setExternalVolumeContributionKg('BODYWEIGHT_REPS', {
        status: 'COMPLETED',
        actualWeightKg: 80,
        actualReps: 10,
      }),
    ).toBe(0);
    expect(
      setExternalVolumeContributionKg('ASSISTED_BODYWEIGHT_REPS', {
        status: 'COMPLETED',
        actualWeightKg: 20,
        actualReps: 8,
      }),
    ).toBe(0);

    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_DURATION',
            sets: [
              weightSet({
                actualWeightKg: 40,
                actualReps: null,
                actualDurationSeconds: 60,
              }),
            ],
          },
        ],
      }),
    );
    expect(metrics.performance.workingExternalVolumeKg).toBe(0);
    expect(metrics.performance.totalDurationSeconds).toBe(60);
  });

  it('SKIPPED / PENDING ne contribuent pas', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({
                status: 'SKIPPED',
                actualWeightKg: 200,
                actualReps: 10,
              }),
              weightSet({
                status: 'PENDING',
                actualWeightKg: 200,
                actualReps: 10,
              }),
            ],
          },
        ],
      }),
    );
    expect(metrics.performance.workingExternalVolumeKg).toBe(0);
  });
});

describe('computeWorkoutMetrics — durée / distance / failure', () => {
  it('agrège durée et distance', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'DURATION',
            sets: [
              weightSet({
                actualWeightKg: null,
                actualReps: null,
                actualDurationSeconds: 90,
              }),
            ],
          },
          {
            measurementType: 'DISTANCE_DURATION',
            sets: [
              weightSet({
                actualWeightKg: null,
                actualReps: null,
                actualDurationSeconds: 400,
                actualDistanceMeters: 1500,
              }),
            ],
          },
        ],
      }),
    );
    expect(metrics.performance.totalDurationSeconds).toBe(490);
    expect(metrics.performance.totalDistanceMeters).toBe(1500);
  });

  it('distingue failedSetCount et reachedFailure', () => {
    const metrics = computeWorkoutMetrics(
      session({
        exercises: [
          {
            measurementType: 'WEIGHT_REPS',
            sets: [
              weightSet({ status: 'FAILED', reachedFailure: false, actualReps: 0 }),
              weightSet({ status: 'COMPLETED', reachedFailure: true }),
              weightSet({ status: 'PARTIAL', reachedFailure: true, actualReps: 4 }),
            ],
          },
        ],
      }),
    );
    expect(metrics.sets.failed).toBe(1);
    expect(metrics.sets.reachedFailure).toBe(2);
  });
});

describe('elapsed / official', () => {
  it('calcule elapsedDurationSeconds', () => {
    expect(
      computeElapsedDurationSeconds({
        startedAt: '2026-08-10T08:00:00.000Z',
        completedAt: '2026-08-10T09:12:00.000Z',
      }),
    ).toBe(72 * 60);
  });

  it('retourne null si timestamps manquants ou incohérents', () => {
    expect(
      computeElapsedDurationSeconds({
        startedAt: null,
        completedAt: '2026-08-10T09:00:00.000Z',
      }),
    ).toBeNull();
    expect(
      computeElapsedDurationSeconds({
        startedAt: '2026-08-10T09:00:00.000Z',
        completedAt: '2026-08-10T08:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('résout métriques officielles uniquement pour COMPLETED', () => {
    const input = session({
      exercises: [
        {
          measurementType: 'WEIGHT_REPS',
          sets: [weightSet()],
        },
      ],
    });
    expect(resolveOfficialWorkoutMetrics('COMPLETED', input)).not.toBeNull();
    expect(resolveOfficialWorkoutMetrics('ACTIVE', input)).toBeNull();
    expect(resolveOfficialWorkoutMetrics('PAUSED', input)).toBeNull();
    expect(resolveOfficialWorkoutMetrics('CANCELLED', input)).toBeNull();
  });
});
