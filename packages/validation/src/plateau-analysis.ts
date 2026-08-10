/**
 * Détection déterministe de stagnation / plateau (jalon 5.3).
 * Lecture seule — aucune prescription, aucune persistance.
 */

import { z } from 'zod';

import { estimateOneRepMaxEpley } from './one-rep-max';
import { addExternalVolumeKg } from './workout-metrics';

export const PLATEAU_HISTORY_LIMIT = 6;
export const PLATEAU_MIN_WORKOUTS_FOR_SIGNAL = 3;
export const PLATEAU_MIN_WORKOUTS_FOR_PLATEAU = 4;
/** Amélioration e1RM inférieure à ce % = stable. */
export const E1RM_PROGRESS_TOLERANCE_PERCENT = 1;
/** Hausse de charge minimale (kg) si aucun incrément matériel connu. */
export const LOAD_PROGRESS_TOLERANCE_KG = 1;
/** Écart de plage de reps toléré avant REVIEW. */
export const PLATEAU_REP_RANGE_TOLERANCE = 1;
/** Écart de nombre de séries de travail toléré avant REVIEW. */
export const PLATEAU_WORKING_SET_COUNT_TOLERANCE = 1;

export type PlateauStatus =
  | 'NONE'
  | 'WATCH'
  | 'PLATEAU'
  | 'INSUFFICIENT_DATA'
  | 'REVIEW';

export type PlateauReason =
  | 'NO_ELIGIBLE_HISTORY'
  | 'INSUFFICIENT_WORKOUTS'
  | 'INCONSISTENT_EQUIPMENT'
  | 'INCONSISTENT_TARGETS'
  | 'LOAD_NOT_INCREASING'
  | 'MAX_REPS_NOT_INCREASING'
  | 'E1RM_NOT_INCREASING'
  | 'REPEATED_TARGET_MISSES'
  | 'REPEATED_FAILURES'
  | 'EFFORT_TREND_HIGH'
  | 'RECENT_PROGRESS_DETECTED'
  | 'UNSUPPORTED_MEASUREMENT_TYPE'
  | 'SOURCE_EXERCISE_MISSING';

export type PlateauSetInput = {
  setType: string;
  status: string;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  targetWeightKg: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
};

export type PlateauSessionInput = {
  workoutSessionId: string;
  localDate: string;
  startedAt: string;
  equipmentTypeId: string | null;
  sets: PlateauSetInput[];
};

export type PlateauWorkoutPoint = {
  workoutSessionId: string;
  localDate: string;
  maxWeightKg: number | null;
  maxReps: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  workingExternalVolumeKg: number;
  workingSetCount: number;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  targetWeightKg: number | null;
  averageRir: number | null;
  averageRpe: number | null;
  effortCoverage: {
    trackedSetCount: number;
    eligibleSetCount: number;
  };
  reachedFailureCount: number;
};

export type DetectExercisePlateauInput = {
  exerciseId: string;
  measurementType: string;
  sessions: PlateauSessionInput[];
  /** Filtre optionnel (même identité que progress/records). */
  equipmentTypeId?: string | null;
};

export type PlateauAnalysisResult = {
  exerciseId: string;
  supported: boolean;
  status: PlateauStatus;
  range: {
    analyzedWorkoutCount: number;
    firstWorkoutDate: string | null;
    latestWorkoutDate: string | null;
  };
  current: {
    maxWeightKg: number | null;
    maxReps: number | null;
    estimatedOneRepMaxKg: number | null;
  };
  trend: {
    loadChangeKg: number | null;
    e1rmChangeKg: number | null;
    e1rmChangePercent: number | null;
    maxRepsChange: number | null;
  };
  evidence: PlateauWorkoutPoint[];
  reasons: PlateauReason[];
  effortCoverage: {
    trackedSetCount: number;
    eligibleSetCount: number;
  };
};

function isWorkingAnalyzedStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED';
}

function isWorkingSet(set: PlateauSetInput): boolean {
  return set.setType === 'WORKING' && isWorkingAnalyzedStatus(set.status);
}

function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function modeNumber(values: Array<number | null>): number | null {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Dérive les métriques d’une séance pour l’analyse de plateau (WORKING uniquement).
 */
export function buildPlateauWorkoutPoint(
  session: PlateauSessionInput,
): PlateauWorkoutPoint | null {
  const working = session.sets.filter(isWorkingSet);
  if (working.length === 0) {
    return null;
  }

  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let bestE1rm: number | null = null;
  let volume = 0;
  let completedSetCount = 0;
  let partialSetCount = 0;
  let failedSetCount = 0;
  let reachedFailureCount = 0;
  const rirValues: number[] = [];
  const rpeValues: number[] = [];

  for (const set of working) {
    if (set.status === 'COMPLETED') completedSetCount += 1;
    if (set.status === 'PARTIAL') partialSetCount += 1;
    if (set.status === 'FAILED') failedSetCount += 1;
    if (set.reachedFailure) reachedFailureCount += 1;

    if (set.actualWeightKg != null && set.actualWeightKg > 0) {
      maxWeightKg =
        maxWeightKg == null
          ? set.actualWeightKg
          : Math.max(maxWeightKg, set.actualWeightKg);
    }
    if (
      set.status === 'COMPLETED' &&
      set.actualReps != null &&
      Number.isFinite(set.actualReps)
    ) {
      maxReps =
        maxReps == null ? set.actualReps : Math.max(maxReps, set.actualReps);
    }

    if (
      set.status === 'COMPLETED' &&
      set.actualWeightKg != null &&
      set.actualWeightKg > 0 &&
      set.actualReps != null &&
      Number.isInteger(set.actualReps) &&
      set.actualReps >= 1 &&
      set.actualReps <= 12
    ) {
      const e1rm = estimateOneRepMaxEpley(set.actualWeightKg, set.actualReps);
      if (e1rm != null) {
        bestE1rm = bestE1rm == null ? e1rm : Math.max(bestE1rm, e1rm);
      }
    }

    if (
      (set.status === 'COMPLETED' || set.status === 'PARTIAL') &&
      set.actualWeightKg != null &&
      set.actualWeightKg > 0 &&
      set.actualReps != null &&
      set.actualReps > 0
    ) {
      volume = addExternalVolumeKg(volume, set.actualWeightKg, set.actualReps);
    }

    if (set.actualRir != null && Number.isFinite(set.actualRir)) {
      rirValues.push(set.actualRir);
    }
    if (set.actualRpe != null && Number.isFinite(set.actualRpe)) {
      rpeValues.push(set.actualRpe);
    }
  }

  const trackedSetCount = rirValues.length + rpeValues.length > 0
    ? new Set([
        ...working
          .map((set, index) =>
            set.actualRir != null || set.actualRpe != null ? index : -1,
          )
          .filter((index) => index >= 0),
      ]).size
    : 0;

  return {
    workoutSessionId: session.workoutSessionId,
    localDate: session.localDate,
    maxWeightKg: maxWeightKg != null ? roundKg(maxWeightKg) : null,
    maxReps,
    bestEstimatedOneRepMaxKg: bestE1rm != null ? roundKg(bestE1rm) : null,
    workingExternalVolumeKg: volume,
    workingSetCount: working.length,
    completedSetCount,
    partialSetCount,
    failedSetCount,
    targetMinReps: modeNumber(working.map((set) => set.targetRepMin)),
    targetMaxReps: modeNumber(working.map((set) => set.targetRepMax)),
    targetWeightKg: modeNumber(working.map((set) => set.targetWeightKg)),
    averageRir:
      rirValues.length > 0
        ? roundKg(rirValues.reduce((a, b) => a + b, 0) / rirValues.length)
        : null,
    averageRpe:
      rpeValues.length > 0
        ? roundKg(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length)
        : null,
    effortCoverage: {
      trackedSetCount,
      eligibleSetCount: working.length,
    },
    reachedFailureCount,
  };
}

export function hasMeaningfulLoadProgress(
  pointsChronological: PlateauWorkoutPoint[],
  toleranceKg: number = LOAD_PROGRESS_TOLERANCE_KG,
): boolean {
  const weights = pointsChronological
    .map((point) => point.maxWeightKg)
    .filter((value): value is number => value != null);
  if (weights.length < 2) {
    return false;
  }
  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  if (last - first >= toleranceKg) {
    return true;
  }
  for (let i = 1; i < weights.length; i += 1) {
    if (weights[i]! - weights[i - 1]! >= toleranceKg) {
      return true;
    }
  }
  return false;
}

export function hasMeaningfulE1rmProgress(
  pointsChronological: PlateauWorkoutPoint[],
  tolerancePercent: number = E1RM_PROGRESS_TOLERANCE_PERCENT,
): boolean {
  const values = pointsChronological
    .map((point) => point.bestEstimatedOneRepMaxKg)
    .filter((value): value is number => value != null && value > 0);
  if (values.length < 2) {
    return false;
  }
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const changePercent = ((last - first) / first) * 100;
  if (changePercent >= tolerancePercent) {
    return true;
  }
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    if (((curr - prev) / prev) * 100 >= tolerancePercent) {
      return true;
    }
  }
  return false;
}

/**
 * Progression de reps à charge comparable (même charge max ± tolérance).
 */
export function hasRepetitionProgress(
  pointsChronological: PlateauWorkoutPoint[],
  loadToleranceKg: number = LOAD_PROGRESS_TOLERANCE_KG,
): boolean {
  const withBoth = pointsChronological.filter(
    (point) => point.maxWeightKg != null && point.maxReps != null,
  );
  if (withBoth.length < 2) {
    return false;
  }
  const anchor = modeNumber(withBoth.map((point) => point.maxWeightKg));
  if (anchor == null) {
    return false;
  }
  const comparable = withBoth.filter(
    (point) => Math.abs((point.maxWeightKg ?? 0) - anchor) < loadToleranceKg,
  );
  if (comparable.length < 2) {
    return false;
  }
  const firstReps = comparable[0]!.maxReps!;
  const lastReps = comparable[comparable.length - 1]!.maxReps!;
  if (lastReps > firstReps) {
    return true;
  }
  for (let i = 1; i < comparable.length; i += 1) {
    if (comparable[i]!.maxReps! > comparable[i - 1]!.maxReps!) {
      return true;
    }
  }
  return false;
}

export function hasRepeatedTargetMisses(
  pointsChronological: PlateauWorkoutPoint[],
): boolean {
  const withTarget = pointsChronological.filter(
    (point) => point.targetMinReps != null,
  );
  if (withTarget.length < 2) {
    return false;
  }
  let missSessions = 0;
  for (const point of withTarget) {
    const min = point.targetMinReps!;
    // Séance « miss » : max reps < min cible, ou majorité partielle/échouée.
    const underperformed =
      (point.maxReps != null && point.maxReps < min) ||
      point.partialSetCount + point.failedSetCount >=
        Math.ceil(point.workingSetCount / 2);
    if (underperformed) {
      missSessions += 1;
    }
  }
  return missSessions >= 2;
}

export function hasRepeatedFailures(
  pointsChronological: PlateauWorkoutPoint[],
): boolean {
  const sessionsWithIssue = pointsChronological.filter(
    (point) => point.failedSetCount > 0 || point.partialSetCount > 0,
  ).length;
  return sessionsWithIssue >= 2;
}

export function hasHighEffortTrend(
  pointsChronological: PlateauWorkoutPoint[],
): boolean {
  const withRir = pointsChronological.filter(
    (point) => point.averageRir != null,
  );
  if (withRir.length >= 3) {
    const first = withRir[0]!.averageRir!;
    const last = withRir[withRir.length - 1]!.averageRir!;
    if (first - last >= 2) {
      return true;
    }
  }
  const withRpe = pointsChronological.filter(
    (point) => point.averageRpe != null,
  );
  if (withRpe.length >= 3) {
    const first = withRpe[0]!.averageRpe!;
    const last = withRpe[withRpe.length - 1]!.averageRpe!;
    if (last - first >= 2) {
      return true;
    }
  }
  return false;
}

function emptyResult(
  exerciseId: string,
  status: PlateauStatus,
  reasons: PlateauReason[],
  supported = true,
): PlateauAnalysisResult {
  return {
    exerciseId,
    supported,
    status,
    range: {
      analyzedWorkoutCount: 0,
      firstWorkoutDate: null,
      latestWorkoutDate: null,
    },
    current: {
      maxWeightKg: null,
      maxReps: null,
      estimatedOneRepMaxKg: null,
    },
    trend: {
      loadChangeKg: null,
      e1rmChangeKg: null,
      e1rmChangePercent: null,
      maxRepsChange: null,
    },
    evidence: [],
    reasons,
    effortCoverage: { trackedSetCount: 0, eligibleSetCount: 0 },
  };
}

function targetsComparable(points: PlateauWorkoutPoint[]): boolean {
  const withRange = points.filter(
    (point) => point.targetMinReps != null && point.targetMaxReps != null,
  );
  if (withRange.length >= 2) {
    const mins = withRange.map((point) => point.targetMinReps!);
    const maxs = withRange.map((point) => point.targetMaxReps!);
    if (
      Math.max(...mins) - Math.min(...mins) > PLATEAU_REP_RANGE_TOLERANCE ||
      Math.max(...maxs) - Math.min(...maxs) > PLATEAU_REP_RANGE_TOLERANCE
    ) {
      return false;
    }
  }
  const setCounts = points.map((point) => point.workingSetCount);
  if (
    Math.max(...setCounts) - Math.min(...setCounts) >
    PLATEAU_WORKING_SET_COUNT_TOLERANCE
  ) {
    return false;
  }
  return true;
}

function neverReachedTargetMax(points: PlateauWorkoutPoint[]): boolean {
  const withMax = points.filter((point) => point.targetMaxReps != null);
  if (withMax.length < 2) {
    return false;
  }
  return withMax.every(
    (point) =>
      point.maxReps == null || point.maxReps < (point.targetMaxReps ?? 0),
  );
}

function repsStagnant(pointsChronological: PlateauWorkoutPoint[]): boolean {
  const reps = pointsChronological
    .map((point) => point.maxReps)
    .filter((value): value is number => value != null);
  if (reps.length < 2) {
    return true;
  }
  const first = reps[0]!;
  return reps.every((value) => value === first);
}

function computeTrend(pointsChronological: PlateauWorkoutPoint[]) {
  const first = pointsChronological[0];
  const last = pointsChronological[pointsChronological.length - 1];
  if (!first || !last) {
    return {
      loadChangeKg: null,
      e1rmChangeKg: null,
      e1rmChangePercent: null,
      maxRepsChange: null,
    };
  }
  const loadChangeKg =
    first.maxWeightKg != null && last.maxWeightKg != null
      ? roundKg(last.maxWeightKg - first.maxWeightKg)
      : null;
  const e1rmChangeKg =
    first.bestEstimatedOneRepMaxKg != null &&
    last.bestEstimatedOneRepMaxKg != null
      ? roundKg(last.bestEstimatedOneRepMaxKg - first.bestEstimatedOneRepMaxKg)
      : null;
  const e1rmChangePercent =
    first.bestEstimatedOneRepMaxKg != null &&
    last.bestEstimatedOneRepMaxKg != null &&
    first.bestEstimatedOneRepMaxKg > 0
      ? roundPercent(
          ((last.bestEstimatedOneRepMaxKg - first.bestEstimatedOneRepMaxKg) /
            first.bestEstimatedOneRepMaxKg) *
            100,
        )
      : null;
  const maxRepsChange =
    first.maxReps != null && last.maxReps != null
      ? last.maxReps - first.maxReps
      : null;
  return { loadChangeKg, e1rmChangeKg, e1rmChangePercent, maxRepsChange };
}

/**
 * Détecte un signal de stagnation / plateau à partir de séances COMPATIBLES.
 * `sessions` attendues déjà filtrées COMPLETED + sourceExerciseId (ordre quelconque).
 */
export function detectExercisePlateau(
  input: DetectExercisePlateauInput,
): PlateauAnalysisResult {
  if (input.measurementType !== 'WEIGHT_REPS') {
    return emptyResult(
      input.exerciseId,
      'INSUFFICIENT_DATA',
      ['UNSUPPORTED_MEASUREMENT_TYPE'],
      false,
    );
  }

  let sessions = [...input.sessions];
  if (input.equipmentTypeId !== undefined && input.equipmentTypeId !== null) {
    sessions = sessions.filter(
      (session) => session.equipmentTypeId === input.equipmentTypeId,
    );
  }

  // Tri récent → ancien, puis fenêtre.
  sessions.sort((a, b) => {
    if (a.localDate !== b.localDate) {
      return a.localDate < b.localDate ? 1 : -1;
    }
    return a.startedAt < b.startedAt ? 1 : -1;
  });

  const pointsNewestFirst: PlateauWorkoutPoint[] = [];
  const equipmentIds = new Set<string | null>();

  for (const session of sessions) {
    if (pointsNewestFirst.length >= PLATEAU_HISTORY_LIMIT) {
      break;
    }
    const point = buildPlateauWorkoutPoint(session);
    if (!point) {
      continue;
    }
    pointsNewestFirst.push(point);
    equipmentIds.add(session.equipmentTypeId);
  }

  if (pointsNewestFirst.length === 0) {
    return emptyResult(input.exerciseId, 'INSUFFICIENT_DATA', [
      'NO_ELIGIBLE_HISTORY',
    ]);
  }

  // Sans filtre équipement : plusieurs identités → REVIEW.
  if (
    (input.equipmentTypeId === undefined || input.equipmentTypeId === null) &&
    equipmentIds.size > 1
  ) {
    return {
      ...emptyResult(input.exerciseId, 'REVIEW', ['INCONSISTENT_EQUIPMENT']),
      range: {
        analyzedWorkoutCount: pointsNewestFirst.length,
        firstWorkoutDate:
          pointsNewestFirst[pointsNewestFirst.length - 1]?.localDate ?? null,
        latestWorkoutDate: pointsNewestFirst[0]?.localDate ?? null,
      },
      evidence: pointsNewestFirst,
    };
  }

  if (!targetsComparable(pointsNewestFirst)) {
    return {
      ...emptyResult(input.exerciseId, 'REVIEW', ['INCONSISTENT_TARGETS']),
      range: {
        analyzedWorkoutCount: pointsNewestFirst.length,
        firstWorkoutDate:
          pointsNewestFirst[pointsNewestFirst.length - 1]?.localDate ?? null,
        latestWorkoutDate: pointsNewestFirst[0]?.localDate ?? null,
      },
      evidence: pointsNewestFirst,
    };
  }

  if (pointsNewestFirst.length < PLATEAU_MIN_WORKOUTS_FOR_SIGNAL) {
    const chronological = [...pointsNewestFirst].reverse();
    const latest = pointsNewestFirst[0]!;
    return {
      exerciseId: input.exerciseId,
      supported: true,
      status: 'INSUFFICIENT_DATA',
      range: {
        analyzedWorkoutCount: pointsNewestFirst.length,
        firstWorkoutDate: chronological[0]?.localDate ?? null,
        latestWorkoutDate: latest.localDate,
      },
      current: {
        maxWeightKg: latest.maxWeightKg,
        maxReps: latest.maxReps,
        estimatedOneRepMaxKg: latest.bestEstimatedOneRepMaxKg,
      },
      trend: computeTrend(chronological),
      evidence: pointsNewestFirst,
      reasons: ['INSUFFICIENT_WORKOUTS'],
      effortCoverage: {
        trackedSetCount: pointsNewestFirst.reduce(
          (sum, point) => sum + point.effortCoverage.trackedSetCount,
          0,
        ),
        eligibleSetCount: pointsNewestFirst.reduce(
          (sum, point) => sum + point.effortCoverage.eligibleSetCount,
          0,
        ),
      },
    };
  }

  const chronological = [...pointsNewestFirst].reverse();
  const latest = pointsNewestFirst[0]!;
  const reasons: PlateauReason[] = [];

  const loadProgress = hasMeaningfulLoadProgress(chronological);
  const e1rmProgress = hasMeaningfulE1rmProgress(chronological);
  const repsProgress = hasRepetitionProgress(chronological);
  const targetMisses = hasRepeatedTargetMisses(chronological);
  const failures = hasRepeatedFailures(chronological);
  const effortHigh = hasHighEffortTrend(chronological);
  const neverTop = neverReachedTargetMax(chronological);
  const stagnantReps = repsStagnant(chronological);
  const noPrimaryProgress = !loadProgress && !e1rmProgress;

  // Progression sur la dernière séance après une sous-fenêtre stagnante.
  const prior = chronological.slice(0, -1);
  const stagnantPrior =
    prior.length >= PLATEAU_MIN_WORKOUTS_FOR_SIGNAL &&
    !hasMeaningfulLoadProgress(prior) &&
    !hasMeaningfulE1rmProgress(prior) &&
    !hasRepetitionProgress(prior);
  const recentProgressBreak =
    stagnantPrior && (loadProgress || e1rmProgress || repsProgress);

  let status: PlateauStatus = 'NONE';

  if (loadProgress || e1rmProgress || repsProgress) {
    status = 'NONE';
    if (recentProgressBreak) {
      reasons.push('RECENT_PROGRESS_DETECTED');
    }
  } else {
    if (!loadProgress) reasons.push('LOAD_NOT_INCREASING');
    if (!e1rmProgress) reasons.push('E1RM_NOT_INCREASING');
    if (stagnantReps) reasons.push('MAX_REPS_NOT_INCREASING');
    if (targetMisses) reasons.push('REPEATED_TARGET_MISSES');
    if (failures) reasons.push('REPEATED_FAILURES');
    if (effortHigh) reasons.push('EFFORT_TREND_HIGH');

    const secondarySignal =
      stagnantReps || neverTop || targetMisses || failures || effortHigh;

    if (
      chronological.length >= PLATEAU_MIN_WORKOUTS_FOR_PLATEAU &&
      noPrimaryProgress &&
      secondarySignal
    ) {
      status = 'PLATEAU';
    } else if (
      chronological.length >= PLATEAU_MIN_WORKOUTS_FOR_SIGNAL &&
      noPrimaryProgress &&
      (secondarySignal || !repsProgress)
    ) {
      status = 'WATCH';
    }
  }

  // Une mauvaise séance isolée après une progression antérieure ≠ plateau.
  if (status === 'PLATEAU' || status === 'WATCH') {
    const beforeLast = chronological.slice(0, -1);
    if (
      beforeLast.length >= 2 &&
      (hasMeaningfulLoadProgress(beforeLast) ||
        hasMeaningfulE1rmProgress(beforeLast) ||
        hasRepetitionProgress(beforeLast))
    ) {
      status = 'NONE';
      reasons.length = 0;
    }
  }

  const effortCoverage = {
    trackedSetCount: pointsNewestFirst.reduce(
      (sum, point) => sum + point.effortCoverage.trackedSetCount,
      0,
    ),
    eligibleSetCount: pointsNewestFirst.reduce(
      (sum, point) => sum + point.effortCoverage.eligibleSetCount,
      0,
    ),
  };

  return {
    exerciseId: input.exerciseId,
    supported: true,
    status,
    range: {
      analyzedWorkoutCount: pointsNewestFirst.length,
      firstWorkoutDate: chronological[0]?.localDate ?? null,
      latestWorkoutDate: latest.localDate,
    },
    current: {
      maxWeightKg: latest.maxWeightKg,
      maxReps: latest.maxReps,
      estimatedOneRepMaxKg: latest.bestEstimatedOneRepMaxKg,
    },
    trend: computeTrend(chronological),
    evidence: pointsNewestFirst,
    reasons: [...new Set(reasons)],
    effortCoverage,
  };
}

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

export const plateauAnalysisQuerySchema = z
  .object({
    equipmentId: z.preprocess(
      emptyQueryToUndefined,
      z.string().uuid().optional(),
    ),
  })
  .strict();

export type PlateauAnalysisQuery = z.infer<typeof plateauAnalysisQuerySchema>;
