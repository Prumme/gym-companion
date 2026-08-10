import { z } from 'zod';

/**
 * 1RM estimé — formule Epley V1 (jalon 4.5).
 *
 * e1RM = weight × (1 + reps / 30)
 * reps = 1 → e1RM = weight
 *
 * Indicateur dérivé (pas de table). Estimation ≠ charge réellement soulevée.
 * RIR / RPE n’influencent pas le calcul.
 *
 * Éligibilité (plus stricte que 4.2/4.3) :
 * - measurementTypeSnapshot = WEIGHT_REPS
 * - séance COMPLETED
 * - série COMPLETED
 * - setType ≠ WARMUP
 * - 1 ≤ reps ≤ 12
 * - actualWeightKg > 0
 */

export const ONE_REP_MAX_FORMULA = 'EPLEY_V1' as const;
export type OneRepMaxFormula = typeof ONE_REP_MAX_FORMULA;

export const MIN_E1RM_REPS = 1;
export const MAX_E1RM_REPS = 12;

function isValidLocalDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format YYYY-MM-DD.')
  .refine(isValidLocalDateString, 'La date locale est invalide.');

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

export const exerciseStrengthQuerySchema = z
  .object({
    from: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    to: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    equipmentId: z.preprocess(
      emptyQueryToUndefined,
      z.string().uuid().optional(),
    ),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRENGTH_INVALID_DATE_RANGE',
        path: ['to'],
      });
    }
  });

export type ExerciseStrengthQuery = z.infer<typeof exerciseStrengthQuerySchema>;

export type ExerciseStrengthQueryParseErrorCode =
  | 'STRENGTH_INVALID_FROM_DATE'
  | 'STRENGTH_INVALID_TO_DATE'
  | 'STRENGTH_INVALID_DATE_RANGE'
  | 'STRENGTH_INVALID_QUERY';

export type ExerciseStrengthQueryParseResult =
  | { ok: true; data: ExerciseStrengthQuery }
  | {
      ok: false;
      code: ExerciseStrengthQueryParseErrorCode;
      message: string;
    };

function strengthQueryErrorMessage(
  code: ExerciseStrengthQueryParseErrorCode,
): string {
  switch (code) {
    case 'STRENGTH_INVALID_FROM_DATE':
      return 'Date de début invalide.';
    case 'STRENGTH_INVALID_TO_DATE':
      return 'Date de fin invalide.';
    case 'STRENGTH_INVALID_DATE_RANGE':
      return 'La date de début doit être antérieure ou égale à la date de fin.';
    case 'STRENGTH_INVALID_QUERY':
      return 'Paramètres de force estimée invalides.';
  }
}

export function parseExerciseStrengthQuery(
  raw: unknown,
): ExerciseStrengthQueryParseResult {
  const result = exerciseStrengthQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  for (const issue of result.error.issues) {
    if (issue.message === 'STRENGTH_INVALID_DATE_RANGE') {
      return {
        ok: false,
        code: 'STRENGTH_INVALID_DATE_RANGE',
        message: strengthQueryErrorMessage('STRENGTH_INVALID_DATE_RANGE'),
      };
    }
    const path = issue.path[0];
    if (path === 'from') {
      return {
        ok: false,
        code: 'STRENGTH_INVALID_FROM_DATE',
        message: strengthQueryErrorMessage('STRENGTH_INVALID_FROM_DATE'),
      };
    }
    if (path === 'to') {
      return {
        ok: false,
        code: 'STRENGTH_INVALID_TO_DATE',
        message: strengthQueryErrorMessage('STRENGTH_INVALID_TO_DATE'),
      };
    }
  }
  return {
    ok: false,
    code: 'STRENGTH_INVALID_QUERY',
    message: strengthQueryErrorMessage('STRENGTH_INVALID_QUERY'),
  };
}

/**
 * Formule Epley V1.
 * Retourne null si les entrées sont inutilisables (non finies, hors plage, etc.).
 */
export function estimateOneRepMaxEpley(
  weightKg: number,
  reps: number,
): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return null;
  }
  if (weightKg <= 0) {
    return null;
  }
  if (!Number.isInteger(reps) || reps < MIN_E1RM_REPS || reps > MAX_E1RM_REPS) {
    return null;
  }
  if (reps === 1) {
    return weightKg;
  }
  const value = weightKg * (1 + reps / 30);
  return Number.isFinite(value) ? value : null;
}

export type EstimatedOneRepMaxEligibilityInput = {
  measurementType: string;
  sessionStatus: string;
  setStatus: string;
  setType: string;
  actualWeightKg: number | null;
  actualReps: number | null;
  sourceExerciseId: string | null;
};

export function isEligibleForEstimatedOneRepMax(
  input: EstimatedOneRepMaxEligibilityInput,
): boolean {
  if (input.sourceExerciseId == null) {
    return false;
  }
  if (input.measurementType !== 'WEIGHT_REPS') {
    return false;
  }
  if (input.sessionStatus !== 'COMPLETED') {
    return false;
  }
  if (input.setStatus !== 'COMPLETED') {
    return false;
  }
  if (input.setType === 'WARMUP') {
    return false;
  }
  if (input.actualWeightKg == null || input.actualWeightKg <= 0) {
    return false;
  }
  if (
    input.actualReps == null ||
    !Number.isInteger(input.actualReps) ||
    input.actualReps < MIN_E1RM_REPS ||
    input.actualReps > MAX_E1RM_REPS
  ) {
    return false;
  }
  return true;
}

export type EstimatedOneRepMaxCandidate = {
  estimatedOneRepMaxKg: number;
  formula: OneRepMaxFormula;
  weightKg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  reachedFailure: boolean;
  setType: string;
  position: number;
  workoutSessionId: string;
  workoutSessionExerciseId: string;
  workoutSetId: string;
  localDate: string;
  completedAt: string | null;
};

export type StrengthSetInput = {
  id: string;
  setType: string;
  status: string;
  position: number;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  completedAt: string | null;
};

export type StrengthOccurrenceInput = {
  id: string;
  sourceExerciseId: string | null;
  measurementType: string;
  equipmentTypeId: string | null;
  sets: StrengthSetInput[];
};

export type StrengthSessionInput = {
  workoutSessionId: string;
  sessionStatus: string;
  localDate: string;
  startedAt: string;
  exercises: StrengthOccurrenceInput[];
};

export function compareEstimatedOneRepMaxCandidates(
  a: EstimatedOneRepMaxCandidate,
  b: EstimatedOneRepMaxCandidate,
): number {
  if (a.estimatedOneRepMaxKg !== b.estimatedOneRepMaxKg) {
    return b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg;
  }
  if (a.weightKg !== b.weightKg) {
    return b.weightKg - a.weightKg;
  }
  if (a.reps !== b.reps) {
    return a.reps - b.reps;
  }
  if (a.position !== b.position) {
    return a.position - b.position;
  }
  return a.workoutSetId < b.workoutSetId
    ? -1
    : a.workoutSetId > b.workoutSetId
      ? 1
      : 0;
}

export function collectEstimatedOneRepMaxCandidates(
  session: StrengthSessionInput,
): EstimatedOneRepMaxCandidate[] {
  const candidates: EstimatedOneRepMaxCandidate[] = [];
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (
        !isEligibleForEstimatedOneRepMax({
          measurementType: exercise.measurementType,
          sessionStatus: session.sessionStatus,
          setStatus: set.status,
          setType: set.setType,
          actualWeightKg: set.actualWeightKg,
          actualReps: set.actualReps,
          sourceExerciseId: exercise.sourceExerciseId,
        })
      ) {
        continue;
      }
      const estimated = estimateOneRepMaxEpley(
        set.actualWeightKg!,
        set.actualReps!,
      );
      if (estimated == null) {
        continue;
      }
      candidates.push({
        estimatedOneRepMaxKg: estimated,
        formula: ONE_REP_MAX_FORMULA,
        weightKg: set.actualWeightKg!,
        reps: set.actualReps!,
        rir: set.actualRir,
        rpe: set.actualRpe,
        reachedFailure: set.reachedFailure,
        setType: set.setType,
        position: set.position,
        workoutSessionId: session.workoutSessionId,
        workoutSessionExerciseId: exercise.id,
        workoutSetId: set.id,
        localDate: session.localDate,
        completedAt: set.completedAt,
      });
    }
  }
  return candidates;
}

export type EstimatedStrengthPointComputed = {
  workoutSessionId: string;
  workoutSessionExerciseIds: string[];
  localDate: string;
  startedAt: string;
  estimatedOneRepMaxKg: number;
  sourceSet: {
    workoutSessionExerciseId: string;
    workoutSetId: string;
    weightKg: number;
    reps: number;
    rir: number | null;
    rpe: number | null;
    reachedFailure: boolean;
    setType: string;
  };
};

export function computeBestEstimatedOneRepMaxForWorkout(
  session: StrengthSessionInput,
): EstimatedStrengthPointComputed | null {
  const candidates = collectEstimatedOneRepMaxCandidates(session);
  if (candidates.length === 0) {
    return null;
  }
  const best = [...candidates].sort(compareEstimatedOneRepMaxCandidates)[0]!;
  const exerciseIds = [
    ...new Set(
      session.exercises
        .filter(
          (exercise) =>
            exercise.sourceExerciseId != null &&
            exercise.measurementType === 'WEIGHT_REPS',
        )
        .map((exercise) => exercise.id),
    ),
  ];
  return {
    workoutSessionId: session.workoutSessionId,
    workoutSessionExerciseIds: exerciseIds,
    localDate: session.localDate,
    startedAt: session.startedAt,
    estimatedOneRepMaxKg: best.estimatedOneRepMaxKg,
    sourceSet: {
      workoutSessionExerciseId: best.workoutSessionExerciseId,
      workoutSetId: best.workoutSetId,
      weightKg: best.weightKg,
      reps: best.reps,
      rir: best.rir,
      rpe: best.rpe,
      reachedFailure: best.reachedFailure,
      setType: best.setType,
    },
  };
}

export type EstimatedStrengthSource = {
  workoutSessionId: string;
  workoutSessionExerciseId: string;
  workoutSetId: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  reachedFailure: boolean;
  setType: string;
  localDate: string;
};

export type ExerciseStrengthSummaryComputed = {
  formula: OneRepMaxFormula;
  pointCount: number;
  firstEstimatedOneRepMaxKg: number | null;
  latestEstimatedOneRepMaxKg: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  absoluteChangeKg: number | null;
  percentageChange: number | null;
  firstDate: string | null;
  latestDate: string | null;
  bestDate: string | null;
  latestSource: EstimatedStrengthSource | null;
  bestSource: EstimatedStrengthSource | null;
};

function toSource(
  point: EstimatedStrengthPointComputed,
): EstimatedStrengthSource {
  return {
    workoutSessionId: point.workoutSessionId,
    workoutSessionExerciseId: point.sourceSet.workoutSessionExerciseId,
    workoutSetId: point.sourceSet.workoutSetId,
    weightKg: point.sourceSet.weightKg,
    reps: point.sourceSet.reps,
    rir: point.sourceSet.rir,
    rpe: point.sourceSet.rpe,
    reachedFailure: point.sourceSet.reachedFailure,
    setType: point.sourceSet.setType,
    localDate: point.localDate,
  };
}

export function computeExerciseStrengthSummary(
  points: EstimatedStrengthPointComputed[],
): ExerciseStrengthSummaryComputed {
  if (points.length === 0) {
    return {
      formula: ONE_REP_MAX_FORMULA,
      pointCount: 0,
      firstEstimatedOneRepMaxKg: null,
      latestEstimatedOneRepMaxKg: null,
      bestEstimatedOneRepMaxKg: null,
      absoluteChangeKg: null,
      percentageChange: null,
      firstDate: null,
      latestDate: null,
      bestDate: null,
      latestSource: null,
      bestSource: null,
    };
  }

  const first = points[0]!;
  const latest = points[points.length - 1]!;
  let best = first;
  for (const point of points) {
    if (point.estimatedOneRepMaxKg > best.estimatedOneRepMaxKg) {
      best = point;
    }
  }

  const absoluteChangeKg =
    points.length >= 2
      ? latest.estimatedOneRepMaxKg - first.estimatedOneRepMaxKg
      : null;
  let percentageChange: number | null = null;
  if (absoluteChangeKg != null && first.estimatedOneRepMaxKg > 0) {
    percentageChange =
      Math.round(
        ((absoluteChangeKg / first.estimatedOneRepMaxKg) * 100) * 10,
      ) / 10;
  }

  return {
    formula: ONE_REP_MAX_FORMULA,
    pointCount: points.length,
    firstEstimatedOneRepMaxKg: first.estimatedOneRepMaxKg,
    latestEstimatedOneRepMaxKg: latest.estimatedOneRepMaxKg,
    bestEstimatedOneRepMaxKg: best.estimatedOneRepMaxKg,
    absoluteChangeKg,
    percentageChange,
    firstDate: first.localDate,
    latestDate: latest.localDate,
    bestDate: best.localDate,
    latestSource: toSource(latest),
    bestSource: toSource(best),
  };
}

export function compareStrengthPointsAsc(
  a: { localDate: string; startedAt: string; workoutSessionId: string },
  b: { localDate: string; startedAt: string; workoutSessionId: string },
): number {
  if (a.localDate !== b.localDate) {
    return a.localDate < b.localDate ? -1 : 1;
  }
  if (a.startedAt !== b.startedAt) {
    return a.startedAt < b.startedAt ? -1 : 1;
  }
  if (a.workoutSessionId !== b.workoutSessionId) {
    return a.workoutSessionId < b.workoutSessionId ? -1 : 1;
  }
  return 0;
}

export function isStrengthSupportedForMeasurement(
  measurementType: string,
): boolean {
  return measurementType === 'WEIGHT_REPS';
}
