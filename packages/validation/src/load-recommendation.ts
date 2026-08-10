/**
 * Recommandations déterministes de charge (jalon 5.1).
 *
 * Lecture seule — aucune application automatique au programme.
 * Uniquement measurementType = WEIGHT_REPS.
 * Fenêtre : 3 dernières séances COMPLETED éligibles.
 * Warmups exclus ; séries WORKING comme base.
 * Aucune IA.
 */

export const LOAD_RECOMMENDATION_HISTORY_LIMIT = 3;
export const DEFAULT_LOAD_INCREMENT_KG = 2.5;
export const LOAD_RECOMMENDATION_RIR_TOLERANCE = 1;
export const LOAD_RECOMMENDATION_RPE_TOLERANCE = 1;

export type LoadRecommendationAction =
  | 'INCREASE'
  | 'HOLD'
  | 'DECREASE'
  | 'INSUFFICIENT_DATA'
  | 'REVIEW';

export type LoadRecommendationReason =
  | 'TARGET_RANGE_REACHED'
  | 'TARGET_RANGE_PARTIALLY_REACHED'
  | 'TARGET_RANGE_NOT_REACHED'
  | 'EFFORT_ON_TARGET'
  | 'EFFORT_TOO_HIGH'
  | 'EFFORT_LOWER_THAN_TARGET'
  | 'RECENT_FAILURES'
  | 'NO_ELIGIBLE_HISTORY'
  | 'NO_WORKING_SETS'
  | 'UNSUPPORTED_TARGET_CONFIGURATION'
  | 'INCONSISTENT_EQUIPMENT'
  | 'INSUFFICIENT_EFFORT_DATA'
  | 'UNSUPPORTED_MEASUREMENT_TYPE'
  | 'NO_TARGET_WEIGHT'
  | 'NO_TARGET_REP_RANGE'
  | 'SINGLE_UNDERPERFORMANCE'
  | 'COMPARABLE_LOAD_MISMATCH';

export type LoadIncrementSource =
  | 'USER_EXERCISE_PREFERENCE'
  | 'SYSTEM_DEFAULT';

export type SetTargetAssessment =
  | 'ABOVE_TARGET'
  | 'AT_TOP_OF_RANGE'
  | 'IN_RANGE'
  | 'BELOW_RANGE'
  | 'FAILED'
  | 'NOT_ASSESSABLE';

export type EffortAssessment =
  | 'EASIER'
  | 'ON_TARGET'
  | 'HARDER'
  | 'NOT_ASSESSABLE';

export type WorkoutUnderperformanceKind =
  | 'NONE'
  | 'SIGNIFICANT'
  | 'NOT_ASSESSABLE';

export type EffortTrackingModeForLoad = 'NONE' | 'RIR' | 'RPE';

export type WorkoutSetTypeForLoad =
  | 'WARMUP'
  | 'WORKING'
  | 'BACKOFF'
  | 'DROP_SET'
  | 'AMRAP'
  | 'FAILURE_OPTIONAL';

export type WorkoutSetStatusForLoad =
  | 'PENDING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

/** Séries cibles du modèle (entrée moteur). */
export type TemplateSetTargetInput = {
  setType: WorkoutSetTypeForLoad | string;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetWeightKg: number | null;
  targetRir: number | null;
  targetRpe: number | null;
};

/** Série réalisée (entrée moteur). */
export type PerformedSetInput = {
  setType: WorkoutSetTypeForLoad | string;
  status: WorkoutSetStatusForLoad | string;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  targetWeightKg: number | null;
};

/** Séance historique éligible (entrée moteur). */
export type HistoricalWorkoutInput = {
  workoutSessionId: string;
  localDate: string;
  startedAt: string;
  equipmentTypeId: string | null;
  sets: PerformedSetInput[];
};

export type ResolvedLoadTarget = {
  weightKg: number;
  minReps: number;
  maxReps: number;
  targetRir: number | null;
  targetRpe: number | null;
  workingSetCount: number;
};

export type ResolveLoadTargetResult =
  | { ok: true; target: ResolvedLoadTarget }
  | {
      ok: false;
      action: 'INSUFFICIENT_DATA' | 'REVIEW';
      reasons: LoadRecommendationReason[];
    };

export type LoadRecommendationEvidenceWorkout = {
  workoutSessionId: string;
  localDate: string;
  targetWeightKg: number | null;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  performedReps: number[];
  actualRir: number[] | null;
  actualRpe: number[] | null;
};

export type LoadRecommendationSuggestion = {
  suggestedWeightKg: number | null;
  adjustmentKg: number | null;
  incrementKg: number | null;
  incrementSource: LoadIncrementSource | null;
};

export type LoadRecommendationResult = {
  action: LoadRecommendationAction;
  reasons: LoadRecommendationReason[];
  currentTarget: {
    weightKg: number | null;
    minReps: number | null;
    maxReps: number | null;
    targetRir: number | null;
    targetRpe: number | null;
  };
  recommendation: LoadRecommendationSuggestion;
  evidence: {
    workoutCount: number;
    latestWorkoutDate: string | null;
    effortDataUsed: boolean;
    recentWorkouts: LoadRecommendationEvidenceWorkout[];
  };
};

function isWorkingSetType(setType: string): boolean {
  return setType === 'WORKING';
}

/**
 * Arrondi fiable vers un multiple de l’incrément (évite les flottants parasites).
 */
export function roundToLoadIncrement(
  weightKg: number,
  incrementKg: number,
): number {
  if (!(incrementKg > 0) || !Number.isFinite(weightKg)) {
    return weightKg;
  }
  const steps = Math.round(weightKg / incrementKg);
  const raw = steps * incrementKg;
  return Math.round(raw * 1000) / 1000;
}

export function resolveLoadIncrement(_input?: {
  userExerciseIncrementKg?: number | null;
}): {
  incrementKg: number;
  incrementSource: LoadIncrementSource;
} {
  const userInc = _input?.userExerciseIncrementKg;
  if (
    userInc != null &&
    Number.isFinite(userInc) &&
    userInc > 0
  ) {
    return {
      incrementKg: userInc,
      incrementSource: 'USER_EXERCISE_PREFERENCE',
    };
  }
  return {
    incrementKg: DEFAULT_LOAD_INCREMENT_KG,
    incrementSource: 'SYSTEM_DEFAULT',
  };
}

export function computeSuggestedWeightKg(
  action: LoadRecommendationAction,
  currentTargetWeightKg: number | null,
  incrementKg: number,
): { suggestedWeightKg: number | null; adjustmentKg: number | null } {
  if (
    action === 'REVIEW' ||
    action === 'INSUFFICIENT_DATA' ||
    currentTargetWeightKg == null
  ) {
    return { suggestedWeightKg: null, adjustmentKg: null };
  }

  if (action === 'HOLD') {
    return {
      suggestedWeightKg: currentTargetWeightKg,
      adjustmentKg: 0,
    };
  }

  if (action === 'INCREASE') {
    const suggested = roundToLoadIncrement(
      currentTargetWeightKg + incrementKg,
      incrementKg,
    );
    return {
      suggestedWeightKg: suggested,
      adjustmentKg: Math.round((suggested - currentTargetWeightKg) * 1000) / 1000,
    };
  }

  // DECREASE : −2 × incrément, plancher à un incrément (> 0).
  const raw = Math.max(
    currentTargetWeightKg - 2 * incrementKg,
    incrementKg,
  );
  const suggested = roundToLoadIncrement(raw, incrementKg);
  const safe =
    suggested > 0 ? suggested : roundToLoadIncrement(incrementKg, incrementKg);
  return {
    suggestedWeightKg: safe,
    adjustmentKg: Math.round((safe - currentTargetWeightKg) * 1000) / 1000,
  };
}

/**
 * Classification d’une série réalisée contre la plage cible.
 */
export function assessSetAgainstTarget(
  set: PerformedSetInput,
  target: Pick<ResolvedLoadTarget, 'minReps' | 'maxReps'>,
): SetTargetAssessment {
  if (set.setType === 'WARMUP') {
    return 'NOT_ASSESSABLE';
  }
  if (!isWorkingSetType(set.setType)) {
    // BACKOFF / DROP_SET / AMRAP / FAILURE_OPTIONAL : hors décision principale.
    return 'NOT_ASSESSABLE';
  }

  if (set.status === 'SKIPPED' || set.status === 'PENDING' || set.status === 'CANCELLED') {
    return 'NOT_ASSESSABLE';
  }

  if (set.status === 'FAILED') {
    return 'FAILED';
  }

  if (set.status === 'PARTIAL') {
    // Une série partielle n’atteint jamais pleinement la cible.
    return 'FAILED';
  }

  if (set.status !== 'COMPLETED') {
    return 'NOT_ASSESSABLE';
  }

  if (set.actualReps == null || !Number.isFinite(set.actualReps)) {
    return 'NOT_ASSESSABLE';
  }

  const reps = set.actualReps;
  if (reps > target.maxReps) {
    return 'ABOVE_TARGET';
  }
  if (reps === target.maxReps) {
    return 'AT_TOP_OF_RANGE';
  }
  if (reps >= target.minReps && reps < target.maxReps) {
    return 'IN_RANGE';
  }
  return 'BELOW_RANGE';
}

export function assessEffortAgainstTarget(input: {
  mode: EffortTrackingModeForLoad;
  actualRir: number | null;
  actualRpe: number | null;
  targetRir: number | null;
  targetRpe: number | null;
}): EffortAssessment {
  const { mode } = input;
  if (mode === 'NONE') {
    return 'NOT_ASSESSABLE';
  }

  if (mode === 'RIR') {
    if (input.targetRir == null || input.actualRir == null) {
      return 'NOT_ASSESSABLE';
    }
    const delta = input.actualRir - input.targetRir;
    if (delta >= LOAD_RECOMMENDATION_RIR_TOLERANCE + 1) {
      // actualRir >= target + 2 → plus facile
      return 'EASIER';
    }
    if (delta <= -(LOAD_RECOMMENDATION_RIR_TOLERANCE + 1)) {
      // actualRir <= target - 2 → plus difficile
      return 'HARDER';
    }
    return 'ON_TARGET';
  }

  // RPE
  if (input.targetRpe == null || input.actualRpe == null) {
    return 'NOT_ASSESSABLE';
  }
  const delta = input.actualRpe - input.targetRpe;
  if (delta >= LOAD_RECOMMENDATION_RPE_TOLERANCE + 1) {
    // RPE plus élevé → plus difficile
    return 'HARDER';
  }
  if (delta <= -(LOAD_RECOMMENDATION_RPE_TOLERANCE + 1)) {
    return 'EASIER';
  }
  return 'ON_TARGET';
}

export function resolveLoadTargetFromTemplateSets(
  sets: TemplateSetTargetInput[],
  measurementType: string,
): ResolveLoadTargetResult {
  if (measurementType !== 'WEIGHT_REPS') {
    return {
      ok: false,
      action: 'INSUFFICIENT_DATA',
      reasons: ['UNSUPPORTED_MEASUREMENT_TYPE'],
    };
  }

  const working = sets.filter((s) => isWorkingSetType(s.setType));
  if (working.length === 0) {
    return {
      ok: false,
      action: 'INSUFFICIENT_DATA',
      reasons: ['NO_WORKING_SETS'],
    };
  }

  const weights = working.map((s) => s.targetWeightKg);
  const mins = working.map((s) => s.targetRepMin);
  const maxs = working.map((s) => s.targetRepMax);
  const rirs = working.map((s) => s.targetRir);
  const rpes = working.map((s) => s.targetRpe);

  const firstWeight = weights[0] ?? null;
  const firstMin = mins[0] ?? null;
  const firstMax = maxs[0] ?? null;

  if (weights.some((w) => w == null || !(w > 0))) {
    // Toutes absentes / invalides → données insuffisantes ; mixte → REVIEW.
    const allMissing = weights.every((w) => w == null || !(w > 0));
    return {
      ok: false,
      action: allMissing ? 'INSUFFICIENT_DATA' : 'REVIEW',
      reasons: allMissing
        ? ['NO_TARGET_WEIGHT']
        : ['UNSUPPORTED_TARGET_CONFIGURATION'],
    };
  }

  const weightHomogeneous = weights.every(
    (w) =>
      w != null &&
      firstWeight != null &&
      Math.abs(w - firstWeight) < 0.0005,
  );
  const repsHomogeneous = mins.every((m) => m === firstMin) &&
    maxs.every((m) => m === firstMax);
  const rirHomogeneous = rirs.every((r) => r === rirs[0]);
  const rpeHomogeneous = rpes.every((r) => {
    const first = rpes[0];
    if (r == null && first == null) return true;
    if (r == null || first == null) return false;
    return Math.abs(r - first) < 0.05;
  });

  if (!weightHomogeneous || !repsHomogeneous || !rirHomogeneous || !rpeHomogeneous) {
    return {
      ok: false,
      action: 'REVIEW',
      reasons: ['UNSUPPORTED_TARGET_CONFIGURATION'],
    };
  }

  if (
    firstMin == null ||
    firstMax == null ||
    !(firstMin > 0) ||
    !(firstMax >= firstMin)
  ) {
    return {
      ok: false,
      action: 'INSUFFICIENT_DATA',
      reasons: ['NO_TARGET_REP_RANGE'],
    };
  }

  return {
    ok: true,
    target: {
      weightKg: firstWeight!,
      minReps: firstMin,
      maxReps: firstMax,
      targetRir: rirs[0] ?? null,
      targetRpe: rpes[0] ?? null,
      workingSetCount: working.length,
    },
  };
}

function workingPerformedSets(sets: PerformedSetInput[]): PerformedSetInput[] {
  return sets.filter((s) => isWorkingSetType(s.setType));
}

export type WorkoutPerformanceAssessment = {
  assessments: SetTargetAssessment[];
  effortAssessments: EffortAssessment[];
  effortDataUsed: boolean;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  performedReps: number[];
  actualRir: number[];
  actualRpe: number[];
  allAssessableCompleted: boolean;
  allAtTopOrAbove: boolean;
  allInRangeOrAbove: boolean;
  majorityBelowRange: boolean;
  hasPartialOrFailed: boolean;
  effortExcessivelyHard: boolean;
  effortOnOrEasier: boolean;
  underperformance: WorkoutUnderperformanceKind;
  comparableTargetWeightKg: number | null;
};

export function assessWorkoutPerformance(
  sets: PerformedSetInput[],
  target: ResolvedLoadTarget,
  effortMode: EffortTrackingModeForLoad,
): WorkoutPerformanceAssessment {
  const working = workingPerformedSets(sets);
  const assessments = working.map((s) => assessSetAgainstTarget(s, target));

  const effortAssessments = working.map((s) =>
    assessEffortAgainstTarget({
      mode: effortMode,
      actualRir: s.actualRir,
      actualRpe: s.actualRpe,
      targetRir: target.targetRir,
      targetRpe: target.targetRpe,
    }),
  );

  const assessable = assessments.filter((a) => a !== 'NOT_ASSESSABLE');
  const completedSetCount = working.filter((s) => s.status === 'COMPLETED').length;
  const partialSetCount = working.filter((s) => s.status === 'PARTIAL').length;
  const failedSetCount = working.filter((s) => s.status === 'FAILED').length;

  const performedReps = working
    .filter(
      (s) =>
        s.status === 'COMPLETED' ||
        s.status === 'PARTIAL' ||
        s.status === 'FAILED',
    )
    .map((s) => s.actualReps)
    .filter((r): r is number => r != null && Number.isFinite(r));

  const actualRir = working
    .map((s) => s.actualRir)
    .filter((r): r is number => r != null && Number.isFinite(r));
  const actualRpe = working
    .map((s) => s.actualRpe)
    .filter((r): r is number => r != null && Number.isFinite(r));

  const effortDataUsed =
    effortMode !== 'NONE' &&
    effortAssessments.some((e) => e !== 'NOT_ASSESSABLE');

  const hasPartialOrFailed =
    partialSetCount > 0 ||
    failedSetCount > 0 ||
    assessments.includes('FAILED');

  const allAssessableCompleted =
    assessable.length > 0 &&
    assessable.length === working.filter((s) => {
      const a = assessSetAgainstTarget(s, target);
      return a !== 'NOT_ASSESSABLE';
    }).length &&
    !hasPartialOrFailed &&
    working.every((s) => {
      const a = assessSetAgainstTarget(s, target);
      return a === 'NOT_ASSESSABLE' || s.status === 'COMPLETED';
    });

  const relevant = assessable;
  const allAtTopOrAbove =
    relevant.length > 0 &&
    relevant.every((a) => a === 'AT_TOP_OF_RANGE' || a === 'ABOVE_TARGET');

  const allInRangeOrAbove =
    relevant.length > 0 &&
    relevant.every(
      (a) =>
        a === 'IN_RANGE' ||
        a === 'AT_TOP_OF_RANGE' ||
        a === 'ABOVE_TARGET',
    );

  const belowCount = relevant.filter((a) => a === 'BELOW_RANGE' || a === 'FAILED').length;
  const majorityBelowRange =
    relevant.length > 0 && belowCount > relevant.length / 2;

  const hardCount = effortAssessments.filter((e) => e === 'HARDER').length;
  const effortExcessivelyHard =
    effortDataUsed &&
    hardCount > 0 &&
    hardCount >= Math.ceil(
      effortAssessments.filter((e) => e !== 'NOT_ASSESSABLE').length / 2,
    );

  const effortOnOrEasier =
    !effortDataUsed ||
    effortAssessments
      .filter((e) => e !== 'NOT_ASSESSABLE')
      .every((e) => e === 'ON_TARGET' || e === 'EASIER');

  let underperformance: WorkoutUnderperformanceKind = 'NONE';
  if (relevant.length === 0) {
    underperformance = 'NOT_ASSESSABLE';
  } else if (
    majorityBelowRange ||
    (partialSetCount + failedSetCount >= Math.ceil(working.length / 2) &&
      working.length > 0) ||
    effortExcessivelyHard
  ) {
    underperformance = 'SIGNIFICANT';
  }

  const weightSamples = working
    .map((s) => s.targetWeightKg ?? s.actualWeightKg)
    .filter((w): w is number => w != null && Number.isFinite(w) && w > 0);
  const comparableTargetWeightKg =
    weightSamples.length > 0 ? weightSamples[0]! : null;

  return {
    assessments,
    effortAssessments,
    effortDataUsed,
    completedSetCount,
    partialSetCount,
    failedSetCount,
    performedReps,
    actualRir,
    actualRpe,
    allAssessableCompleted,
    allAtTopOrAbove,
    allInRangeOrAbove,
    majorityBelowRange,
    hasPartialOrFailed,
    effortExcessivelyHard,
    effortOnOrEasier,
    underperformance,
    comparableTargetWeightKg,
  };
}

function weightsComparable(
  a: number | null,
  b: number | null,
  incrementKg: number,
): boolean {
  if (a == null || b == null) {
    return false;
  }
  // Même charge ou écart d’au plus un incrément.
  return Math.abs(a - b) <= incrementKg + 0.0005;
}

function buildEvidenceWorkout(
  workout: HistoricalWorkoutInput,
  assessment: WorkoutPerformanceAssessment,
): LoadRecommendationEvidenceWorkout {
  return {
    workoutSessionId: workout.workoutSessionId,
    localDate: workout.localDate,
    targetWeightKg: assessment.comparableTargetWeightKg,
    completedSetCount: assessment.completedSetCount,
    partialSetCount: assessment.partialSetCount,
    failedSetCount: assessment.failedSetCount,
    performedReps: assessment.performedReps,
    actualRir: assessment.actualRir.length > 0 ? assessment.actualRir : null,
    actualRpe: assessment.actualRpe.length > 0 ? assessment.actualRpe : null,
  };
}

function emptyResult(partial: {
  action: LoadRecommendationAction;
  reasons: LoadRecommendationReason[];
  currentTarget?: LoadRecommendationResult['currentTarget'];
  effortDataUsed?: boolean;
  recentWorkouts?: LoadRecommendationEvidenceWorkout[];
}): LoadRecommendationResult {
  return {
    action: partial.action,
    reasons: partial.reasons,
    currentTarget: partial.currentTarget ?? {
      weightKg: null,
      minReps: null,
      maxReps: null,
      targetRir: null,
      targetRpe: null,
    },
    recommendation: {
      suggestedWeightKg: null,
      adjustmentKg: null,
      incrementKg: null,
      incrementSource: null,
    },
    evidence: {
      workoutCount: partial.recentWorkouts?.length ?? 0,
      latestWorkoutDate: partial.recentWorkouts?.[0]?.localDate ?? null,
      effortDataUsed: partial.effortDataUsed ?? false,
      recentWorkouts: partial.recentWorkouts ?? [],
    },
  };
}

export type ResolveLoadRecommendationInput = {
  measurementType: string;
  templateEquipmentTypeId: string | null;
  templateSets: TemplateSetTargetInput[];
  /** Séances les plus récentes en premier (max 3). */
  recentWorkouts: HistoricalWorkoutInput[];
  effortTrackingMode: EffortTrackingModeForLoad;
  userExerciseIncrementKg?: number | null;
};

/**
 * Décision déterministe de charge à partir du contexte déjà chargé.
 */
export function resolveLoadRecommendation(
  input: ResolveLoadRecommendationInput,
): LoadRecommendationResult {
  const targetResult = resolveLoadTargetFromTemplateSets(
    input.templateSets,
    input.measurementType,
  );

  if (!targetResult.ok) {
    return emptyResult({
      action: targetResult.action,
      reasons: targetResult.reasons,
    });
  }

  const target = targetResult.target;
  const currentTarget = {
    weightKg: target.weightKg,
    minReps: target.minReps,
    maxReps: target.maxReps,
    targetRir: target.targetRir,
    targetRpe: target.targetRpe,
  };

  const { incrementKg, incrementSource } = resolveLoadIncrement({
    userExerciseIncrementKg: input.userExerciseIncrementKg,
  });

  const workouts = input.recentWorkouts.slice(
    0,
    LOAD_RECOMMENDATION_HISTORY_LIMIT,
  );

  if (workouts.length === 0) {
    return emptyResult({
      action: 'INSUFFICIENT_DATA',
      reasons: ['NO_ELIGIBLE_HISTORY'],
      currentTarget,
    });
  }

  // Équipement : toute identité différente du modèle → REVIEW.
  for (const workout of workouts) {
    if (workout.equipmentTypeId !== input.templateEquipmentTypeId) {
      const assessments = workouts.map((w) =>
        assessWorkoutPerformance(w.sets, target, input.effortTrackingMode),
      );
      const evidence = workouts.map((w, i) =>
        buildEvidenceWorkout(w, assessments[i]!),
      );
      return emptyResult({
        action: 'REVIEW',
        reasons: ['INCONSISTENT_EQUIPMENT'],
        currentTarget,
        recentWorkouts: evidence,
        effortDataUsed: assessments.some((a) => a.effortDataUsed),
      });
    }
  }

  const assessments = workouts.map((w) =>
    assessWorkoutPerformance(w.sets, target, input.effortTrackingMode),
  );

  const latest = assessments[0]!;
  const evidence = workouts.map((w, i) =>
    buildEvidenceWorkout(w, assessments[i]!),
  );

  if (
    latest.assessments.every((a) => a === 'NOT_ASSESSABLE') ||
    latest.assessments.filter((a) => a !== 'NOT_ASSESSABLE').length === 0
  ) {
    return emptyResult({
      action: 'INSUFFICIENT_DATA',
      reasons: ['NO_WORKING_SETS'],
      currentTarget,
      recentWorkouts: evidence,
      effortDataUsed: latest.effortDataUsed,
    });
  }

  // Charge historique très différente de la cible actuelle → REVIEW.
  if (
    latest.comparableTargetWeightKg != null &&
    !weightsComparable(
      latest.comparableTargetWeightKg,
      target.weightKg,
      incrementKg,
    )
  ) {
    return emptyResult({
      action: 'REVIEW',
      reasons: ['COMPARABLE_LOAD_MISMATCH'],
      currentTarget,
      recentWorkouts: evidence,
      effortDataUsed: latest.effortDataUsed,
    });
  }

  const effortDataUsed = assessments.some((a) => a.effortDataUsed);
  const reasons: LoadRecommendationReason[] = [];

  // —— INCREASE ——
  const canIncrease =
    latest.allAssessableCompleted &&
    latest.allAtTopOrAbove &&
    !latest.hasPartialOrFailed &&
    !latest.effortExcessivelyHard;

  if (canIncrease) {
    reasons.push('TARGET_RANGE_REACHED');
    if (latest.effortDataUsed) {
      if (latest.effortOnOrEasier) {
        const hasEasier = latest.effortAssessments.includes('EASIER');
        reasons.push(
          hasEasier && !latest.effortAssessments.includes('ON_TARGET')
            ? 'EFFORT_LOWER_THAN_TARGET'
            : 'EFFORT_ON_TARGET',
        );
      }
    } else if (input.effortTrackingMode !== 'NONE') {
      reasons.push('INSUFFICIENT_EFFORT_DATA');
    }

    const suggestion = computeSuggestedWeightKg(
      'INCREASE',
      target.weightKg,
      incrementKg,
    );
    return {
      action: 'INCREASE',
      reasons,
      currentTarget,
      recommendation: {
        ...suggestion,
        incrementKg,
        incrementSource,
      },
      evidence: {
        workoutCount: evidence.length,
        latestWorkoutDate: evidence[0]?.localDate ?? null,
        effortDataUsed,
        recentWorkouts: evidence,
      },
    };
  }

  // —— DECREASE (conservateur : 2 séances consécutives) ——
  const previous = assessments[1];
  if (
    latest.underperformance === 'SIGNIFICANT' &&
    previous != null &&
    previous.underperformance === 'SIGNIFICANT' &&
    weightsComparable(
      latest.comparableTargetWeightKg,
      previous.comparableTargetWeightKg,
      incrementKg,
    )
  ) {
    reasons.push('TARGET_RANGE_NOT_REACHED');
    if (
      latest.hasPartialOrFailed ||
      previous.hasPartialOrFailed
    ) {
      reasons.push('RECENT_FAILURES');
    }
    if (latest.effortExcessivelyHard || previous.effortExcessivelyHard) {
      reasons.push('EFFORT_TOO_HIGH');
    }

    const suggestion = computeSuggestedWeightKg(
      'DECREASE',
      target.weightKg,
      incrementKg,
    );
    return {
      action: 'DECREASE',
      reasons,
      currentTarget,
      recommendation: {
        ...suggestion,
        incrementKg,
        incrementSource,
      },
      evidence: {
        workoutCount: evidence.length,
        latestWorkoutDate: evidence[0]?.localDate ?? null,
        effortDataUsed,
        recentWorkouts: evidence,
      },
    };
  }

  // —— HOLD (y compris une seule mauvaise séance) ——
  if (latest.underperformance === 'SIGNIFICANT') {
    reasons.push('SINGLE_UNDERPERFORMANCE');
    if (latest.majorityBelowRange || latest.hasPartialOrFailed) {
      reasons.push('TARGET_RANGE_NOT_REACHED');
    } else if (latest.allAtTopOrAbove || latest.allInRangeOrAbove) {
      reasons.push('TARGET_RANGE_REACHED');
    } else {
      reasons.push('TARGET_RANGE_PARTIALLY_REACHED');
    }
    if (latest.effortExcessivelyHard) {
      reasons.push('EFFORT_TOO_HIGH');
    }
  } else if (latest.allAtTopOrAbove && latest.effortExcessivelyHard) {
    reasons.push('TARGET_RANGE_REACHED');
    reasons.push('EFFORT_TOO_HIGH');
  } else if (latest.allInRangeOrAbove) {
    if (latest.allAtTopOrAbove) {
      reasons.push('TARGET_RANGE_REACHED');
    } else {
      reasons.push('TARGET_RANGE_PARTIALLY_REACHED');
    }
    if (latest.effortDataUsed && latest.effortOnOrEasier) {
      reasons.push('EFFORT_ON_TARGET');
    } else if (latest.effortDataUsed && latest.effortExcessivelyHard) {
      reasons.push('EFFORT_TOO_HIGH');
    } else if (
      input.effortTrackingMode !== 'NONE' &&
      !latest.effortDataUsed
    ) {
      reasons.push('INSUFFICIENT_EFFORT_DATA');
    }
  } else {
    reasons.push('TARGET_RANGE_PARTIALLY_REACHED');
  }

  const suggestion = computeSuggestedWeightKg(
    'HOLD',
    target.weightKg,
    incrementKg,
  );
  return {
    action: 'HOLD',
    reasons,
    currentTarget,
    recommendation: {
      ...suggestion,
      incrementKg,
      incrementSource,
    },
    evidence: {
      workoutCount: evidence.length,
      latestWorkoutDate: evidence[0]?.localDate ?? null,
      effortDataUsed,
      recentWorkouts: evidence,
    },
  };
}
