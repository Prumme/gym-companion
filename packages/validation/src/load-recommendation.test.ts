import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOAD_INCREMENT_KG,
  LOAD_RECOMMENDATION_HISTORY_LIMIT,
  assessSetAgainstTarget,
  assessWorkoutPerformance,
  computeSuggestedWeightKg,
  resolveLoadIncrement,
  LOAD_RECOMMENDATION_ENGINE_VERSION,
  buildLoadRecommendationFingerprint,
  resolveAppliedWeightKg,
  resolveLoadRecommendation,
  resolveLoadTargetFromTemplateSets,
  roundToLoadIncrement,
  type HistoricalWorkoutInput,
  type PerformedSetInput,
  type ResolvedLoadTarget,
  type TemplateSetTargetInput,
} from './load-recommendation';

const TARGET_8_10: ResolvedLoadTarget = {
  weightKg: 80,
  minReps: 8,
  maxReps: 10,
  targetRir: 2,
  targetRpe: null,
  workingSetCount: 3,
};

function workingSet(
  reps: number | null,
  status: PerformedSetInput['status'] = 'COMPLETED',
  extras: Partial<PerformedSetInput> = {},
): PerformedSetInput {
  return {
    setType: 'WORKING',
    status,
    actualReps: reps,
    actualWeightKg: 80,
    actualRir: extras.actualRir ?? null,
    actualRpe: extras.actualRpe ?? null,
    targetWeightKg: 80,
    ...extras,
  };
}

function templateWorking(
  count = 3,
  overrides: Partial<TemplateSetTargetInput> = {},
): TemplateSetTargetInput[] {
  return Array.from({ length: count }, () => ({
    setType: 'WORKING',
    targetRepMin: 8,
    targetRepMax: 10,
    targetWeightKg: 80,
    targetRir: 2,
    targetRpe: null,
    ...overrides,
  }));
}

function workout(
  id: string,
  date: string,
  sets: PerformedSetInput[],
  equipmentTypeId: string | null = 'eq-bar',
): HistoricalWorkoutInput {
  return {
    workoutSessionId: id,
    localDate: date,
    startedAt: `${date}T10:00:00.000Z`,
    equipmentTypeId,
    sets,
  };
}

describe('assessSetAgainstTarget (5.1)', () => {
  it('classifie 10 / 9 / 8 / 7 et statuts', () => {
    expect(
      assessSetAgainstTarget(workingSet(10), TARGET_8_10),
    ).toBe('AT_TOP_OF_RANGE');
    expect(
      assessSetAgainstTarget(workingSet(11), TARGET_8_10),
    ).toBe('ABOVE_TARGET');
    expect(
      assessSetAgainstTarget(workingSet(9), TARGET_8_10),
    ).toBe('IN_RANGE');
    expect(
      assessSetAgainstTarget(workingSet(8), TARGET_8_10),
    ).toBe('IN_RANGE');
    expect(
      assessSetAgainstTarget(workingSet(7), TARGET_8_10),
    ).toBe('BELOW_RANGE');
    expect(
      assessSetAgainstTarget(workingSet(5, 'PARTIAL'), TARGET_8_10),
    ).toBe('FAILED');
    expect(
      assessSetAgainstTarget(workingSet(null, 'FAILED'), TARGET_8_10),
    ).toBe('FAILED');
    expect(
      assessSetAgainstTarget(
        { ...workingSet(12), setType: 'WARMUP' },
        TARGET_8_10,
      ),
    ).toBe('NOT_ASSESSABLE');
    expect(
      assessSetAgainstTarget(workingSet(10, 'SKIPPED'), TARGET_8_10),
    ).toBe('NOT_ASSESSABLE');
  });
});

describe('resolveLoadTargetFromTemplateSets (5.1)', () => {
  it('accepte une config homogène WEIGHT_REPS', () => {
    const result = resolveLoadTargetFromTemplateSets(
      templateWorking(),
      'WEIGHT_REPS',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.weightKg).toBe(80);
      expect(result.target.minReps).toBe(8);
      expect(result.target.maxReps).toBe(10);
    }
  });

  it('refuse les types non WEIGHT_REPS', () => {
    const result = resolveLoadTargetFromTemplateSets(
      templateWorking(),
      'BODYWEIGHT_REPS',
    );
    expect(result).toEqual({
      ok: false,
      action: 'INSUFFICIENT_DATA',
      reasons: ['UNSUPPORTED_MEASUREMENT_TYPE'],
    });
  });

  it('REVIEW si charges / plages hétérogènes', () => {
    const sets = templateWorking();
    sets[2] = { ...sets[2]!, targetWeightKg: 70 };
    const result = resolveLoadTargetFromTemplateSets(sets, 'WEIGHT_REPS');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.action).toBe('REVIEW');
      expect(result.reasons).toContain('UNSUPPORTED_TARGET_CONFIGURATION');
    }
  });

  it('INSUFFICIENT sans working sets ou sans charge', () => {
    expect(
      resolveLoadTargetFromTemplateSets(
        [{ ...templateWorking()[0]!, setType: 'WARMUP' }],
        'WEIGHT_REPS',
      ).ok,
    ).toBe(false);

    const noWeight = templateWorking(3, { targetWeightKg: null });
    const result = resolveLoadTargetFromTemplateSets(noWeight, 'WEIGHT_REPS');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('NO_TARGET_WEIGHT');
    }
  });
});

describe('roundToLoadIncrement / computeSuggestedWeightKg (5.1)', () => {
  it('évite les flottants parasites', () => {
    expect(roundToLoadIncrement(82.5, 2.5)).toBe(82.5);
    expect(roundToLoadIncrement(80 + 2.5, 2.5)).toBe(82.5);
    expect(roundToLoadIncrement(77.5, 2.5)).toBe(77.5);
  });

  it('INCREASE +2.5, DECREASE −5, HOLD inchangé, plancher positif', () => {
    expect(computeSuggestedWeightKg('INCREASE', 80, 2.5)).toEqual({
      suggestedWeightKg: 82.5,
      adjustmentKg: 2.5,
    });
    expect(computeSuggestedWeightKg('DECREASE', 82.5, 2.5)).toEqual({
      suggestedWeightKg: 77.5,
      adjustmentKg: -5,
    });
    expect(computeSuggestedWeightKg('HOLD', 80, 2.5)).toEqual({
      suggestedWeightKg: 80,
      adjustmentKg: 0,
    });
    expect(computeSuggestedWeightKg('DECREASE', 3, 2.5).suggestedWeightKg).toBe(
      2.5,
    );
    expect(
      computeSuggestedWeightKg('REVIEW', 80, 2.5).suggestedWeightKg,
    ).toBeNull();
    expect(
      computeSuggestedWeightKg('INSUFFICIENT_DATA', 80, 2.5).suggestedWeightKg,
    ).toBeNull();
  });

  it('utilise SYSTEM_DEFAULT sans préférence utilisateur', () => {
    expect(resolveLoadIncrement()).toEqual({
      incrementKg: DEFAULT_LOAD_INCREMENT_KG,
      incrementSource: 'SYSTEM_DEFAULT',
    });
    expect(resolveLoadIncrement({ userExerciseIncrementKg: 5 })).toEqual({
      incrementKg: 5,
      incrementSource: 'USER_EXERCISE_PREFERENCE',
    });
  });
});

describe('resolveLoadRecommendation — INCREASE (5.1)', () => {
  it('10/10/10 COMPLETED + RIR sur cible → INCREASE', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'RIR',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10, 'COMPLETED', { actualRir: 2 }),
          workingSet(10, 'COMPLETED', { actualRir: 2 }),
          workingSet(10, 'COMPLETED', { actualRir: 2 }),
        ]),
      ],
    });
    expect(result.action).toBe('INCREASE');
    expect(result.recommendation.suggestedWeightKg).toBe(82.5);
    expect(result.recommendation.incrementSource).toBe('SYSTEM_DEFAULT');
    expect(result.reasons).toContain('TARGET_RANGE_REACHED');
  });

  it('RIR plus facile, RPE sur cible, effort NONE', () => {
    const easier = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'RIR',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10, 'COMPLETED', { actualRir: 4 }),
          workingSet(10, 'COMPLETED', { actualRir: 4 }),
          workingSet(10, 'COMPLETED', { actualRir: 4 }),
        ]),
      ],
    });
    expect(easier.action).toBe('INCREASE');

    const rpeSets = templateWorking(3, { targetRir: null, targetRpe: 8 });
    const rpe = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: rpeSets,
      effortTrackingMode: 'RPE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10, 'COMPLETED', { actualRpe: 8 }),
          workingSet(10, 'COMPLETED', { actualRpe: 8 }),
          workingSet(10, 'COMPLETED', { actualRpe: 8 }),
        ]),
      ],
    });
    expect(rpe.action).toBe('INCREASE');
    expect(rpe.evidence.effortDataUsed).toBe(true);

    const none = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(3, { targetRir: null }),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10),
          workingSet(10),
          workingSet(10),
        ]),
      ],
    });
    expect(none.action).toBe('INCREASE');
    expect(none.evidence.effortDataUsed).toBe(false);
  });

  it('une série sous max → pas INCREASE ; warmup ignoré', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          { ...workingSet(15), setType: 'WARMUP', actualWeightKg: 100 },
          workingSet(10),
          workingSet(10),
          workingSet(9),
        ]),
      ],
    });
    expect(result.action).toBe('HOLD');
  });
});

describe('resolveLoadRecommendation — HOLD (5.1)', () => {
  it('performance dans la plage', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10),
          workingSet(9),
          workingSet(8),
        ]),
      ],
    });
    expect(result.action).toBe('HOLD');
    expect(result.recommendation.suggestedWeightKg).toBe(80);
    expect(result.reasons).toContain('TARGET_RANGE_PARTIALLY_REACHED');
  });

  it('max reps mais RIR beaucoup trop faible → HOLD', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'RIR',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10, 'COMPLETED', { actualRir: 0 }),
          workingSet(10, 'COMPLETED', { actualRir: 0 }),
          workingSet(10, 'COMPLETED', { actualRir: 0 }),
        ]),
      ],
    });
    expect(result.action).toBe('HOLD');
    expect(result.reasons).toContain('EFFORT_TOO_HIGH');
  });

  it('une mauvaise série isolée / une seule mauvaise séance → HOLD', () => {
    const mixed = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10),
          workingSet(9),
          workingSet(7),
        ]),
      ],
    });
    expect(mixed.action).toBe('HOLD');

    const oneBad = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-02', [
          workingSet(7),
          workingSet(6),
          workingSet(5),
        ]),
        workout('w0', '2026-08-01', [
          workingSet(10),
          workingSet(10),
          workingSet(10),
        ]),
      ],
    });
    expect(oneBad.action).toBe('HOLD');
    expect(oneBad.reasons).toContain('SINGLE_UNDERPERFORMANCE');
  });
});

describe('resolveLoadRecommendation — DECREASE (5.1)', () => {
  it('deux mauvaises séances consécutives → DECREASE', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w2', '2026-08-03', [
          workingSet(7),
          workingSet(6),
          workingSet(6),
        ]),
        workout('w1', '2026-08-02', [
          workingSet(7),
          workingSet(6),
          workingSet(5),
        ]),
        workout('w0', '2026-08-01', [
          workingSet(10),
          workingSet(10),
          workingSet(10),
        ]),
      ],
    });
    expect(result.action).toBe('DECREASE');
    expect(result.recommendation.suggestedWeightKg).toBe(75);
    expect(result.evidence.workoutCount).toBeLessThanOrEqual(
      LOAD_RECOMMENDATION_HISTORY_LIMIT,
    );
  });

  it('partial / failed répétées', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w2', '2026-08-03', [
          workingSet(5, 'PARTIAL'),
          workingSet(null, 'FAILED'),
          workingSet(6, 'PARTIAL'),
        ]),
        workout('w1', '2026-08-02', [
          workingSet(4, 'PARTIAL'),
          workingSet(null, 'FAILED'),
          workingSet(5, 'FAILED'),
        ]),
      ],
    });
    expect(result.action).toBe('DECREASE');
    expect(result.reasons).toContain('RECENT_FAILURES');
  });

  it('effort très élevé répété', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'RIR',
      recentWorkouts: [
        workout('w2', '2026-08-03', [
          workingSet(8, 'COMPLETED', { actualRir: 0 }),
          workingSet(8, 'COMPLETED', { actualRir: 0 }),
          workingSet(7, 'COMPLETED', { actualRir: 0 }),
        ]),
        workout('w1', '2026-08-02', [
          workingSet(8, 'COMPLETED', { actualRir: 0 }),
          workingSet(7, 'COMPLETED', { actualRir: 0 }),
          workingSet(7, 'COMPLETED', { actualRir: 0 }),
        ]),
      ],
    });
    expect(result.action).toBe('DECREASE');
    expect(result.reasons).toContain('EFFORT_TOO_HIGH');
  });
});

describe('resolveLoadRecommendation — REVIEW / INSUFFICIENT (5.1)', () => {
  it('équipements incompatibles → REVIEW', () => {
    const result = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout(
          'w1',
          '2026-08-01',
          [workingSet(10), workingSet(10), workingSet(10)],
          'eq-machine',
        ),
      ],
    });
    expect(result.action).toBe('REVIEW');
    expect(result.reasons).toContain('INCONSISTENT_EQUIPMENT');
    expect(result.recommendation.suggestedWeightKg).toBeNull();
  });

  it('aucun historique / charge historique incompatible', () => {
    expect(
      resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
        measurementType: 'WEIGHT_REPS',
        templateEquipmentTypeId: 'eq-bar',
        templateSets: templateWorking(),
        effortTrackingMode: 'NONE',
        recentWorkouts: [],
      }).action,
    ).toBe('INSUFFICIENT_DATA');

    const mismatch = resolveLoadRecommendation({
      workoutTemplateExerciseId: 'wte-1',
      measurementType: 'WEIGHT_REPS',
      templateEquipmentTypeId: 'eq-bar',
      templateSets: templateWorking(),
      effortTrackingMode: 'NONE',
      recentWorkouts: [
        workout('w1', '2026-08-01', [
          workingSet(10, 'COMPLETED', { targetWeightKg: 100, actualWeightKg: 100 }),
          workingSet(10, 'COMPLETED', { targetWeightKg: 100, actualWeightKg: 100 }),
          workingSet(10, 'COMPLETED', { targetWeightKg: 100, actualWeightKg: 100 }),
        ]),
      ],
    });
    expect(mismatch.action).toBe('REVIEW');
    expect(mismatch.reasons).toContain('COMPARABLE_LOAD_MISMATCH');
  });
});

describe('assessWorkoutPerformance — warmup exclu', () => {
  it('ignore le warmup dans les compteurs principaux', () => {
    const assessment = assessWorkoutPerformance(
      [
        { ...workingSet(20), setType: 'WARMUP', actualWeightKg: 120 },
        workingSet(10),
        workingSet(10),
        workingSet(10),
      ],
      TARGET_8_10,
      'NONE',
    );
    expect(assessment.allAtTopOrAbove).toBe(true);
    expect(assessment.completedSetCount).toBe(3);
  });
});

describe('resolveAppliedWeightKg / decisions (5.2)', () => {
  it('ACCEPTED INCREASE/HOLD/DECREASE et IGNORED', () => {
    expect(
      resolveAppliedWeightKg({
        action: 'INCREASE',
        decision: 'ACCEPTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 82.5,
      }),
    ).toEqual({ ok: true, appliedWeightKg: 82.5, mutatesTemplate: true });

    expect(
      resolveAppliedWeightKg({
        action: 'HOLD',
        decision: 'ACCEPTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 80,
      }),
    ).toEqual({ ok: true, appliedWeightKg: 80, mutatesTemplate: false });

    expect(
      resolveAppliedWeightKg({
        action: 'DECREASE',
        decision: 'ACCEPTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 75,
      }),
    ).toEqual({ ok: true, appliedWeightKg: 75, mutatesTemplate: true });

    expect(
      resolveAppliedWeightKg({
        action: 'INCREASE',
        decision: 'IGNORED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 82.5,
      }),
    ).toEqual({ ok: true, appliedWeightKg: null, mutatesTemplate: false });
  });

  it('ADJUSTED et décisions invalides', () => {
    expect(
      resolveAppliedWeightKg({
        action: 'INCREASE',
        decision: 'ADJUSTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 82.5,
        adjustedWeightKg: 81.5,
      }),
    ).toEqual({ ok: true, appliedWeightKg: 81.5, mutatesTemplate: true });

    expect(
      resolveAppliedWeightKg({
        action: 'REVIEW',
        decision: 'ACCEPTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: null,
      }).ok,
    ).toBe(false);

    expect(
      resolveAppliedWeightKg({
        action: 'INSUFFICIENT_DATA',
        decision: 'ADJUSTED',
        currentTargetWeightKg: null,
        suggestedWeightKg: null,
        adjustedWeightKg: 80,
      }).ok,
    ).toBe(false);

    expect(
      resolveAppliedWeightKg({
        action: 'INCREASE',
        decision: 'ADJUSTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 82.5,
      }).ok,
    ).toBe(false);

    expect(
      resolveAppliedWeightKg({
        action: 'INCREASE',
        decision: 'ACCEPTED',
        currentTargetWeightKg: 80,
        suggestedWeightKg: 82.5,
        adjustedWeightKg: 81,
      }).ok,
    ).toBe(false);
  });

  it('fingerprint stable et sensible aux changements', () => {
    const base = {
      workoutTemplateExerciseId: 'wte-1',
      engineVersion: LOAD_RECOMMENDATION_ENGINE_VERSION,
      templateEquipmentTypeId: 'eq-1',
      workingSets: [
        {
          targetWeightKg: 80,
          targetRepMin: 8,
          targetRepMax: 10,
          targetRir: 2,
          targetRpe: null,
        },
      ],
      action: 'INCREASE' as const,
      currentTargetWeightKg: 80,
      suggestedWeightKg: 82.5,
      incrementKg: 2.5,
      incrementSource: 'SYSTEM_DEFAULT' as const,
      recentWorkoutSessionIds: ['w1'],
    };
    const a = buildLoadRecommendationFingerprint(base);
    const b = buildLoadRecommendationFingerprint(base);
    expect(a).toBe(b);
    expect(
      buildLoadRecommendationFingerprint({
        ...base,
        suggestedWeightKg: 85,
      }),
    ).not.toBe(a);
  });
});
