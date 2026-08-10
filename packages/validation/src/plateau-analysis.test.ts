import { describe, expect, it } from 'vitest';

import {
  E1RM_PROGRESS_TOLERANCE_PERCENT,
  LOAD_PROGRESS_TOLERANCE_KG,
  buildPlateauWorkoutPoint,
  detectExercisePlateau,
  hasMeaningfulE1rmProgress,
  hasMeaningfulLoadProgress,
  hasRepetitionProgress,
  hasRepeatedFailures,
  hasRepeatedTargetMisses,
  type PlateauSessionInput,
  type PlateauSetInput,
  type PlateauWorkoutPoint,
} from './plateau-analysis';

function working(
  weight: number,
  reps: number,
  extras: Partial<PlateauSetInput> = {},
): PlateauSetInput {
  return {
    setType: 'WORKING',
    status: 'COMPLETED',
    actualWeightKg: weight,
    actualReps: reps,
    actualRir: null,
    actualRpe: null,
    reachedFailure: false,
    targetWeightKg: weight,
    targetRepMin: 8,
    targetRepMax: 10,
    ...extras,
  };
}

function session(
  id: string,
  date: string,
  sets: PlateauSetInput[],
  equipmentTypeId: string | null = 'eq-bar',
): PlateauSessionInput {
  return {
    workoutSessionId: id,
    localDate: date,
    startedAt: `${date}T10:00:00.000Z`,
    equipmentTypeId,
    sets,
  };
}

function triple(weight: number, reps: number, extras?: Partial<PlateauSetInput>) {
  return [working(weight, reps, extras), working(weight, reps, extras), working(weight, reps, extras)];
}

describe('buildPlateauWorkoutPoint', () => {
  it('ignore warmup et calcule max / volume / e1RM', () => {
    const point = buildPlateauWorkoutPoint(
      session('w1', '2026-08-01', [
        {
          ...working(40, 10),
          setType: 'WARMUP',
        },
        working(80, 8),
        working(80, 8),
        working(80, 8),
      ]),
    );
    expect(point).not.toBeNull();
    expect(point!.maxWeightKg).toBe(80);
    expect(point!.maxReps).toBe(8);
    expect(point!.workingSetCount).toBe(3);
    expect(point!.workingExternalVolumeKg).toBe(80 * 8 * 3);
    expect(point!.bestEstimatedOneRepMaxKg).toBe(101.333);
  });
});

describe('tolérances progression', () => {
  it('charge et e1RM', () => {
    const base: PlateauWorkoutPoint = {
      workoutSessionId: 'a',
      localDate: '2026-08-01',
      maxWeightKg: 80,
      maxReps: 8,
      bestEstimatedOneRepMaxKg: 100,
      workingExternalVolumeKg: 1000,
      workingSetCount: 3,
      completedSetCount: 3,
      partialSetCount: 0,
      failedSetCount: 0,
      targetMinReps: 8,
      targetMaxReps: 10,
      targetWeightKg: 80,
      averageRir: null,
      averageRpe: null,
      effortCoverage: { trackedSetCount: 0, eligibleSetCount: 3 },
      reachedFailureCount: 0,
    };
    expect(
      hasMeaningfulLoadProgress([
        base,
        { ...base, maxWeightKg: 80.5 },
      ]),
    ).toBe(false);
    expect(
      hasMeaningfulLoadProgress([
        base,
        { ...base, maxWeightKg: 80 + LOAD_PROGRESS_TOLERANCE_KG },
      ]),
    ).toBe(true);

    expect(
      hasMeaningfulE1rmProgress([
        base,
        { ...base, bestEstimatedOneRepMaxKg: 100.2 },
      ]),
    ).toBe(false);
    expect(
      hasMeaningfulE1rmProgress([
        base,
        { ...base, bestEstimatedOneRepMaxKg: 100.8 },
      ]),
    ).toBe(false);
    expect(
      hasMeaningfulE1rmProgress([
        base,
        {
          ...base,
          bestEstimatedOneRepMaxKg: 100 * (1 + (E1RM_PROGRESS_TOLERANCE_PERCENT + 0.2) / 100),
        },
      ]),
    ).toBe(true);
  });

  it('progression de reps à charge stable', () => {
    const mk = (reps: number): PlateauWorkoutPoint => ({
      workoutSessionId: `r${reps}`,
      localDate: '2026-08-01',
      maxWeightKg: 80,
      maxReps: reps,
      bestEstimatedOneRepMaxKg: 100,
      workingExternalVolumeKg: 1000,
      workingSetCount: 3,
      completedSetCount: 3,
      partialSetCount: 0,
      failedSetCount: 0,
      targetMinReps: 8,
      targetMaxReps: 10,
      targetWeightKg: 80,
      averageRir: null,
      averageRpe: null,
      effortCoverage: { trackedSetCount: 0, eligibleSetCount: 3 },
      reachedFailureCount: 0,
    });
    expect(hasRepetitionProgress([mk(8), mk(9), mk(10)])).toBe(true);
    expect(hasRepetitionProgress([mk(9), mk(9), mk(9)])).toBe(false);
  });
});

describe('detectExercisePlateau', () => {
  it('INSUFFICIENT_DATA sous 3 séances', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8)),
        session('2', '2026-08-02', triple(80, 8)),
      ],
    });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.reasons).toContain('INSUFFICIENT_WORKOUTS');
  });

  it('WATCH sur 3 séances stables 9 reps', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 9)),
        session('2', '2026-08-02', triple(80, 9)),
        session('3', '2026-08-03', triple(80, 9)),
      ],
    });
    expect(result.status).toBe('WATCH');
    expect(result.reasons).toContain('LOAD_NOT_INCREASING');
    expect(result.reasons).toContain('MAX_REPS_NOT_INCREASING');
  });

  it('PLATEAU sur 4 séances 8/8/8', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8)),
        session('2', '2026-08-02', triple(80, 8)),
        session('3', '2026-08-03', triple(80, 8)),
        session('4', '2026-08-04', triple(80, 8)),
      ],
    });
    expect(result.status).toBe('PLATEAU');
    expect(result.range.analyzedWorkoutCount).toBe(4);
  });

  it('NONE quand les reps progressent', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8)),
        session('2', '2026-08-02', [
          working(80, 9),
          working(80, 8),
          working(80, 8),
        ]),
        session('3', '2026-08-03', [
          working(80, 9),
          working(80, 9),
          working(80, 8),
        ]),
        session('4', '2026-08-04', [
          working(80, 10),
          working(80, 9),
          working(80, 9),
        ]),
      ],
    });
    expect(result.status).toBe('NONE');
  });

  it('NONE après hausse de charge récente', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8)),
        session('2', '2026-08-02', triple(80, 8)),
        session('3', '2026-08-03', triple(80, 8)),
        session('4', '2026-08-04', triple(80, 8)),
        session('5', '2026-08-05', triple(82.5, 8)),
      ],
    });
    expect(result.status).toBe('NONE');
    expect(result.reasons).toContain('RECENT_PROGRESS_DETECTED');
  });

  it('NONE sur progression charge progressive', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8)),
        session('2', '2026-08-02', triple(80, 9)),
        session('3', '2026-08-03', triple(80, 10)),
        session('4', '2026-08-04', triple(82.5, 8)),
      ],
    });
    expect(result.status).toBe('NONE');
  });

  it('PLATEAU avec misses / partials répétés', () => {
    const miss = (reps: number): PlateauSetInput[] => [
      working(80, reps, { status: 'PARTIAL', targetRepMin: 8, targetRepMax: 10 }),
      working(80, reps, { status: 'PARTIAL', targetRepMin: 8, targetRepMax: 10 }),
      working(80, reps, { status: 'FAILED', actualReps: null, targetRepMin: 8, targetRepMax: 10 }),
    ];
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', miss(7)),
        session('2', '2026-08-02', miss(6)),
        session('3', '2026-08-03', miss(7)),
        session('4', '2026-08-04', miss(6)),
      ],
    });
    expect(result.status).toBe('PLATEAU');
    expect(hasRepeatedTargetMisses(result.evidence.reverse())).toBe(true);
    expect(hasRepeatedFailures(result.evidence)).toBe(true);
  });

  it('effort RIR renforce mais ne déclenche pas seul', () => {
    const withRir = (rir: number) =>
      triple(80, 9, { actualRir: rir });
    const three = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', withRir(3)),
        session('2', '2026-08-02', withRir(2)),
        session('3', '2026-08-03', withRir(1)),
      ],
    });
    expect(three.status).toBe('WATCH');
    expect(three.reasons).toContain('EFFORT_TREND_HIGH');

    // Effort seul sans stagnation reps/charge sur 2 séances → insufficient
    const two = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', withRir(3)),
        session('2', '2026-08-02', withRir(0)),
      ],
    });
    expect(two.status).toBe('INSUFFICIENT_DATA');
  });

  it('REVIEW équipements incompatibles', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 8), 'eq-bar'),
        session('2', '2026-08-02', triple(80, 8), 'eq-db'),
        session('3', '2026-08-03', triple(80, 8), 'eq-bar'),
      ],
    });
    expect(result.status).toBe('REVIEW');
    expect(result.reasons).toContain('INCONSISTENT_EQUIPMENT');
  });

  it('REVIEW cibles incompatibles', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      sessions: [
        session('1', '2026-08-01', triple(80, 5, { targetRepMin: 3, targetRepMax: 5 })),
        session('2', '2026-08-02', triple(80, 10, { targetRepMin: 8, targetRepMax: 12 })),
        session('3', '2026-08-03', triple(80, 10, { targetRepMin: 8, targetRepMax: 12 })),
      ],
    });
    expect(result.status).toBe('REVIEW');
    expect(result.reasons).toContain('INCONSISTENT_TARGETS');
  });

  it('unsupported measurement', () => {
    const result = detectExercisePlateau({
      exerciseId: 'ex-1',
      measurementType: 'BODYWEIGHT_REPS',
      sessions: [session('1', '2026-08-01', triple(0, 10))],
    });
    expect(result.supported).toBe(false);
    expect(result.status).toBe('INSUFFICIENT_DATA');
  });
});
