import { z } from 'zod';

import {
  addExternalVolumeKg,
  contributesToExternalVolume,
  contributesToTotalReps,
  isPerformedSetStatus,
  setExternalVolumeContributionKg,
} from './workout-metrics';

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

/**
 * Progression temporelle par exercice (jalon 4.3).
 *
 * Source de vérité : séances COMPLETED + snapshots (WorkoutSessionExercise / WorkoutSet).
 * Pas de table matérialisée. Pas de 1RM, pace, ni recommandations.
 *
 * Warmups :
 * - exclus de MAX_WEIGHT, MAX_REPS, WORKING_EXTERNAL_VOLUME ;
 * - inclus dans TOTAL_REPS, TOTAL_DURATION, TOTAL_DISTANCE (quantité réellement effectuée).
 *
 * Séries : COMPLETED | PARTIAL | FAILED avec valeurs réelles (plus souple que records 4.1).
 * WORKING_EXTERNAL_VOLUME réutilise exactement la définition 4.2 (hors WARMUP, WEIGHT_REPS).
 */

export const EXERCISE_PROGRESS_MAX_POINTS = 500;

export const exerciseProgressMetricSchema = z.enum([
  'MAX_WEIGHT',
  'MAX_REPS',
  'WORKING_EXTERNAL_VOLUME',
  'TOTAL_REPS',
  'MAX_DURATION',
  'TOTAL_DURATION',
  'MAX_DISTANCE',
  'TOTAL_DISTANCE',
]);

export type ExerciseProgressMetric = z.infer<typeof exerciseProgressMetricSchema>;

export type ExerciseMeasurementTypeForProgress =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'ASSISTED_BODYWEIGHT_REPS'
  | 'REPS_ONLY'
  | 'DURATION'
  | 'DISTANCE_DURATION'
  | 'WEIGHT_DURATION';

const METRIC_ORDER: ExerciseProgressMetric[] = [
  'MAX_WEIGHT',
  'MAX_REPS',
  'WORKING_EXTERNAL_VOLUME',
  'TOTAL_REPS',
  'MAX_DURATION',
  'TOTAL_DURATION',
  'MAX_DISTANCE',
  'TOTAL_DISTANCE',
];

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

/** Métriques disponibles pour un type de mesure snapshot. */
export function resolveAvailableProgressMetrics(
  measurementType: ExerciseMeasurementTypeForProgress,
): ExerciseProgressMetric[] {
  switch (measurementType) {
    case 'WEIGHT_REPS':
      return [
        'MAX_WEIGHT',
        'MAX_REPS',
        'WORKING_EXTERNAL_VOLUME',
        'TOTAL_REPS',
      ];
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      return ['MAX_REPS', 'TOTAL_REPS'];
    case 'DURATION':
      return ['MAX_DURATION', 'TOTAL_DURATION'];
    case 'DISTANCE_DURATION':
      return [
        'MAX_DISTANCE',
        'TOTAL_DISTANCE',
        'MAX_DURATION',
        'TOTAL_DURATION',
      ];
    case 'WEIGHT_DURATION':
      return ['MAX_WEIGHT', 'MAX_DURATION', 'TOTAL_DURATION'];
    default: {
      const _exhaustive: never = measurementType;
      return _exhaustive;
    }
  }
}

/** Métrique par défaut selon le type de mesure principal. */
export function resolveDefaultProgressMetric(
  measurementType: ExerciseMeasurementTypeForProgress,
): ExerciseProgressMetric {
  switch (measurementType) {
    case 'WEIGHT_REPS':
    case 'WEIGHT_DURATION':
      return 'MAX_WEIGHT';
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      return 'MAX_REPS';
    case 'DURATION':
      return 'MAX_DURATION';
    case 'DISTANCE_DURATION':
      return 'MAX_DISTANCE';
    default: {
      const _exhaustive: never = measurementType;
      return _exhaustive;
    }
  }
}

/** Union ordonnée des métriques compatibles avec plusieurs types historiques. */
export function resolveAvailableProgressMetricsFromTypes(
  measurementTypes: ExerciseMeasurementTypeForProgress[],
): ExerciseProgressMetric[] {
  const set = new Set<ExerciseProgressMetric>();
  for (const type of measurementTypes) {
    for (const metric of resolveAvailableProgressMetrics(type)) {
      set.add(metric);
    }
  }
  return METRIC_ORDER.filter((metric) => set.has(metric));
}

export function isProgressMetricCompatibleWithMeasurement(
  metric: ExerciseProgressMetric,
  measurementType: ExerciseMeasurementTypeForProgress,
): boolean {
  return resolveAvailableProgressMetrics(measurementType).includes(metric);
}

/** Warmups exclus des métriques « performance principale ». */
export function excludesWarmupFromProgressMetric(
  metric: ExerciseProgressMetric,
): boolean {
  return (
    metric === 'MAX_WEIGHT' ||
    metric === 'MAX_REPS' ||
    metric === 'WORKING_EXTERNAL_VOLUME'
  );
}

function isFiniteNonNegative(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

export type ExerciseProgressSetInput = {
  id: string;
  setType: string;
  status: string;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
};

export type ExerciseProgressOccurrenceInput = {
  id: string;
  measurementType: ExerciseMeasurementTypeForProgress;
  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  sets: ExerciseProgressSetInput[];
};

export type ExerciseProgressSessionInput = {
  workoutSessionId: string;
  localDate: string;
  startedAt: string;
  exercises: ExerciseProgressOccurrenceInput[];
};

export type ExerciseProgressPointContext = {
  measurementType: ExerciseMeasurementTypeForProgress;
  maxWeightKg: number | null;
  maxReps: number | null;
  workingExternalVolumeKg: number | null;
  totalReps: number | null;
  maxDurationSeconds: number | null;
  totalDurationSeconds: number | null;
  maxDistanceMeters: number | null;
  totalDistanceMeters: number | null;
  performedSetCount: number;
  equipmentTypeId: string | null;
  equipmentName: string | null;
};

export type ExerciseProgressPointComputed = {
  workoutSessionId: string;
  workoutSessionExerciseIds: string[];
  localDate: string;
  startedAt: string;
  value: number;
  context: ExerciseProgressPointContext;
};

type FlatSet = ExerciseProgressSetInput & {
  measurementType: ExerciseMeasurementTypeForProgress;
  workoutSessionExerciseId: string;
};

function flattenCompatibleSets(
  exercises: ExerciseProgressOccurrenceInput[],
  metric: ExerciseProgressMetric,
): FlatSet[] {
  const result: FlatSet[] = [];
  for (const exercise of exercises) {
    if (
      !isProgressMetricCompatibleWithMeasurement(
        metric,
        exercise.measurementType,
      )
    ) {
      continue;
    }
    for (const set of exercise.sets) {
      result.push({
        ...set,
        measurementType: exercise.measurementType,
        workoutSessionExerciseId: exercise.id,
      });
    }
  }
  return result;
}

function buildContextFromSets(
  exercises: ExerciseProgressOccurrenceInput[],
  sets: FlatSet[],
): ExerciseProgressPointContext {
  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let workingExternalVolumeKg = 0;
  let totalReps = 0;
  let maxDurationSeconds: number | null = null;
  let totalDurationSeconds = 0;
  let maxDistanceMeters: number | null = null;
  let totalDistanceMeters = 0;
  let performedSetCount = 0;

  let maxWeightRepsAtMax: number | null = null;
  let maxRepsWeightAtMax: number | null = null;

  for (const set of sets) {
    if (!isPerformedSetStatus(set.status)) {
      continue;
    }
    performedSetCount += 1;
    const isWarmup = set.setType === 'WARMUP';

    if (
      contributesToTotalReps(set.measurementType) &&
      isFiniteNonNegative(set.actualReps)
    ) {
      totalReps += set.actualReps;
    }

    if (
      !isWarmup &&
      contributesToExternalVolume(set.measurementType) &&
      isFiniteNonNegative(set.actualWeightKg) &&
      isFiniteNonNegative(set.actualReps)
    ) {
      workingExternalVolumeKg = addExternalVolumeKg(
        workingExternalVolumeKg,
        set.actualWeightKg,
        set.actualReps,
      );
    }

    if (!isWarmup && isFiniteNonNegative(set.actualWeightKg)) {
      if (
        maxWeightKg == null ||
        set.actualWeightKg > maxWeightKg ||
        (set.actualWeightKg === maxWeightKg &&
          (set.actualReps ?? -1) > (maxWeightRepsAtMax ?? -1))
      ) {
        maxWeightKg = set.actualWeightKg;
        maxWeightRepsAtMax = set.actualReps;
      }
    }

    if (!isWarmup && isFiniteNonNegative(set.actualReps)) {
      if (
        maxReps == null ||
        set.actualReps > maxReps ||
        (set.actualReps === maxReps &&
          (set.actualWeightKg ?? -1) > (maxRepsWeightAtMax ?? -1))
      ) {
        maxReps = set.actualReps;
        maxRepsWeightAtMax = set.actualWeightKg;
      }
    }

    if (isFiniteNonNegative(set.actualDurationSeconds)) {
      totalDurationSeconds += set.actualDurationSeconds;
      if (
        maxDurationSeconds == null ||
        set.actualDurationSeconds > maxDurationSeconds
      ) {
        maxDurationSeconds = set.actualDurationSeconds;
      }
    }

    if (isFiniteNonNegative(set.actualDistanceMeters)) {
      totalDistanceMeters =
        Math.round(
          (totalDistanceMeters + set.actualDistanceMeters) * 1_000_000,
        ) / 1_000_000;
      if (
        maxDistanceMeters == null ||
        set.actualDistanceMeters > maxDistanceMeters
      ) {
        maxDistanceMeters = set.actualDistanceMeters;
      }
    }
  }

  const equipmentIds = new Set(
    exercises
      .map((exercise) => exercise.equipmentTypeId)
      .filter((id): id is string => id != null),
  );
  const equipmentNames = new Set(
    exercises
      .map((exercise) => exercise.equipmentNameSnapshot)
      .filter((name): name is string => name != null && name.length > 0),
  );

  return {
    measurementType: exercises[0]!.measurementType,
    maxWeightKg,
    maxReps,
    workingExternalVolumeKg:
      workingExternalVolumeKg > 0 ? workingExternalVolumeKg : null,
    totalReps: totalReps > 0 ? totalReps : null,
    maxDurationSeconds,
    totalDurationSeconds:
      totalDurationSeconds > 0 ? totalDurationSeconds : null,
    maxDistanceMeters,
    totalDistanceMeters:
      totalDistanceMeters > 0 ? totalDistanceMeters : null,
    performedSetCount,
    equipmentTypeId: equipmentIds.size === 1 ? [...equipmentIds][0]! : null,
    equipmentName: equipmentNames.size === 1 ? [...equipmentNames][0]! : null,
  };
}

function resolveMetricValue(
  metric: ExerciseProgressMetric,
  sets: FlatSet[],
  context: ExerciseProgressPointContext,
): number | null {
  const candidates = sets.filter((set) => {
    if (!isPerformedSetStatus(set.status)) {
      return false;
    }
    if (excludesWarmupFromProgressMetric(metric) && set.setType === 'WARMUP') {
      return false;
    }
    return true;
  });

  switch (metric) {
    case 'MAX_WEIGHT': {
      let best: FlatSet | null = null;
      for (const set of candidates) {
        if (!isFiniteNonNegative(set.actualWeightKg)) {
          continue;
        }
        if (!best) {
          best = set;
          continue;
        }
        if (set.actualWeightKg > best.actualWeightKg!) {
          best = set;
          continue;
        }
        if (set.actualWeightKg === best.actualWeightKg) {
          const reps = set.actualReps ?? -1;
          const bestReps = best.actualReps ?? -1;
          if (reps > bestReps || (reps === bestReps && set.id < best.id)) {
            best = set;
          }
        }
      }
      return best?.actualWeightKg ?? null;
    }
    case 'MAX_REPS': {
      let best: FlatSet | null = null;
      for (const set of candidates) {
        if (!isFiniteNonNegative(set.actualReps)) {
          continue;
        }
        if (!best) {
          best = set;
          continue;
        }
        if (set.actualReps > best.actualReps!) {
          best = set;
          continue;
        }
        if (set.actualReps === best.actualReps) {
          const weight = set.actualWeightKg ?? -1;
          const bestWeight = best.actualWeightKg ?? -1;
          if (
            weight > bestWeight ||
            (weight === bestWeight && set.id < best.id)
          ) {
            best = set;
          }
        }
      }
      return best?.actualReps ?? null;
    }
    case 'WORKING_EXTERNAL_VOLUME': {
      let volume = 0;
      let any = false;
      for (const set of candidates) {
        const contribution = setExternalVolumeContributionKg(
          set.measurementType,
          set,
        );
        if (contribution > 0) {
          any = true;
          volume =
            Math.round((volume + contribution) * 1_000_000) / 1_000_000;
        }
      }
      return any ? volume : null;
    }
    case 'TOTAL_REPS': {
      let total = 0;
      let any = false;
      for (const set of candidates) {
        if (
          contributesToTotalReps(set.measurementType) &&
          isFiniteNonNegative(set.actualReps)
        ) {
          any = true;
          total += set.actualReps;
        }
      }
      return any ? total : null;
    }
    case 'MAX_DURATION':
      return context.maxDurationSeconds;
    case 'TOTAL_DURATION': {
      let total = 0;
      let any = false;
      for (const set of candidates) {
        if (isFiniteNonNegative(set.actualDurationSeconds)) {
          any = true;
          total += set.actualDurationSeconds;
        }
      }
      return any ? total : null;
    }
    case 'MAX_DISTANCE':
      return context.maxDistanceMeters;
    case 'TOTAL_DISTANCE': {
      let total = 0;
      let any = false;
      for (const set of candidates) {
        if (isFiniteNonNegative(set.actualDistanceMeters)) {
          any = true;
          total =
            Math.round((total + set.actualDistanceMeters) * 1_000_000) /
            1_000_000;
        }
      }
      return any ? total : null;
    }
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

/**
 * Un point = une séance terminée + un exercice (agrégation multi-occurrences).
 * Retourne null si aucune série compatible ne produit de valeur pour la métrique.
 */
export function computeExerciseWorkoutProgressPoint(
  session: ExerciseProgressSessionInput,
  metric: ExerciseProgressMetric,
): ExerciseProgressPointComputed | null {
  const compatibleExercises = session.exercises.filter((exercise) =>
    isProgressMetricCompatibleWithMeasurement(metric, exercise.measurementType),
  );
  if (compatibleExercises.length === 0) {
    return null;
  }

  const sets = flattenCompatibleSets(compatibleExercises, metric);
  const context = buildContextFromSets(compatibleExercises, sets);
  if (context.performedSetCount === 0) {
    return null;
  }

  const value = resolveMetricValue(metric, sets, context);
  if (value == null) {
    return null;
  }

  return {
    workoutSessionId: session.workoutSessionId,
    workoutSessionExerciseIds: compatibleExercises.map((exercise) => exercise.id),
    localDate: session.localDate,
    startedAt: session.startedAt,
    value,
    context,
  };
}

export type ExerciseProgressSummaryComputed = {
  metric: ExerciseProgressMetric;
  pointCount: number;
  firstValue: number | null;
  latestValue: number | null;
  bestValue: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  firstDate: string | null;
  latestDate: string | null;
  bestDate: string | null;
};

export function computeExerciseProgressSummary(
  points: Array<{ value: number; localDate: string }>,
  metric: ExerciseProgressMetric,
): ExerciseProgressSummaryComputed {
  if (points.length === 0) {
    return {
      metric,
      pointCount: 0,
      firstValue: null,
      latestValue: null,
      bestValue: null,
      absoluteChange: null,
      percentageChange: null,
      firstDate: null,
      latestDate: null,
      bestDate: null,
    };
  }

  const first = points[0]!;
  const latest = points[points.length - 1]!;
  let best = first;
  for (const point of points) {
    if (point.value > best.value) {
      best = point;
    }
  }

  const absoluteChange =
    points.length >= 2 ? latest.value - first.value : null;
  let percentageChange: number | null = null;
  if (absoluteChange != null && first.value > 0) {
    percentageChange =
      Math.round(((absoluteChange / first.value) * 100) * 10) / 10;
  }

  return {
    metric,
    pointCount: points.length,
    firstValue: first.value,
    latestValue: latest.value,
    bestValue: best.value,
    absoluteChange,
    percentageChange,
    firstDate: first.localDate,
    latestDate: latest.localDate,
    bestDate: best.localDate,
  };
}

export function compareExerciseProgressPointsAsc(
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

export const exerciseProgressQuerySchema = z
  .object({
    metric: z.preprocess(
      emptyQueryToUndefined,
      exerciseProgressMetricSchema.optional(),
    ),
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
        message: 'PROGRESS_INVALID_DATE_RANGE',
        path: ['to'],
      });
    }
  });

export type ExerciseProgressQuery = z.infer<typeof exerciseProgressQuerySchema>;

export type ExerciseProgressQueryParseErrorCode =
  | 'PROGRESS_INVALID_METRIC'
  | 'PROGRESS_INVALID_FROM_DATE'
  | 'PROGRESS_INVALID_TO_DATE'
  | 'PROGRESS_INVALID_DATE_RANGE'
  | 'PROGRESS_INVALID_QUERY';

export type ExerciseProgressQueryParseResult =
  | { ok: true; data: ExerciseProgressQuery }
  | {
      ok: false;
      code: ExerciseProgressQueryParseErrorCode;
      message: string;
    };

function progressQueryErrorMessage(
  code: ExerciseProgressQueryParseErrorCode,
): string {
  switch (code) {
    case 'PROGRESS_INVALID_METRIC':
      return 'Métrique de progression invalide.';
    case 'PROGRESS_INVALID_FROM_DATE':
      return 'Date de début invalide.';
    case 'PROGRESS_INVALID_TO_DATE':
      return 'Date de fin invalide.';
    case 'PROGRESS_INVALID_DATE_RANGE':
      return 'La date de début doit être antérieure ou égale à la date de fin.';
    case 'PROGRESS_INVALID_QUERY':
      return 'Paramètres de progression invalides.';
  }
}

/** Parse la query progression avec codes d’erreur métier stables. */
export function parseExerciseProgressQuery(
  raw: unknown,
): ExerciseProgressQueryParseResult {
  const result = exerciseProgressQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  for (const issue of result.error.issues) {
    if (issue.message === 'PROGRESS_INVALID_DATE_RANGE') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_DATE_RANGE',
        message: progressQueryErrorMessage('PROGRESS_INVALID_DATE_RANGE'),
      };
    }
    const path = issue.path[0];
    if (path === 'metric') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_METRIC',
        message: progressQueryErrorMessage('PROGRESS_INVALID_METRIC'),
      };
    }
    if (path === 'from') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_FROM_DATE',
        message: progressQueryErrorMessage('PROGRESS_INVALID_FROM_DATE'),
      };
    }
    if (path === 'to') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_TO_DATE',
        message: progressQueryErrorMessage('PROGRESS_INVALID_TO_DATE'),
      };
    }
  }

  return {
    ok: false,
    code: 'PROGRESS_INVALID_QUERY',
    message: progressQueryErrorMessage('PROGRESS_INVALID_QUERY'),
  };
}

/** Helper dates locales pour presets frontend (sans décalage UTC silencieux). */
export function addLocalDateDays(localDate: string, days: number): string {
  if (!isValidLocalDateString(localDate)) {
    throw new Error('INVALID_LOCAL_DATE');
  }
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addLocalDateMonths(localDate: string, months: number): string {
  if (!isValidLocalDateString(localDate)) {
    throw new Error('INVALID_LOCAL_DATE');
  }
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
