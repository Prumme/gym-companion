import { z } from 'zod';

import {
  addLocalDateDays,
  addLocalDateMonths,
} from './exercise-progress';
import { computeWorkoutMetrics, type WorkoutMetricsSessionInput } from './workout-metrics';

/**
 * Dashboard global de progression (jalon 4.4).
 *
 * Dérivé des séances COMPLETED + snapshots. Réutilise les définitions 4.2
 * (computeWorkoutMetrics) pour les totaux. Pas de coaching, pas de table
 * matérialisée.
 *
 * Fréquence :
 * - activeDayCount = dates locales distinctes avec ≥1 séance COMPLETED
 * - averageWorkoutsPerWeek = workoutCount / (daysInRange / 7)
 *   si daysInRange >= 7, sinon null (daysInRange = bornes inclusives).
 *
 * Granularité timeline (centrée, partagée backend/frontend) :
 * - ≤ 45 jours → DAY
 * - ≤ 9 mois (~274 jours) → WEEK (lundi→dimanche)
 * - au-delà → MONTH (calendaire)
 */

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

export const PROGRESS_OVERVIEW_TOP_EXERCISES_LIMIT = 5;
export const PROGRESS_OVERVIEW_RECENT_RECORDS_LIMIT = 5;
/** Seuil inclusif : ≤ 45 jours → buckets DAY. */
export const PROGRESS_OVERVIEW_DAY_BUCKET_MAX_DAYS = 45;
/** Seuil inclusif : ≤ ~9 mois → buckets WEEK ; au-delà MONTH. */
export const PROGRESS_OVERVIEW_WEEK_BUCKET_MAX_DAYS = 274;

export const progressOverviewMetricSchema = z.enum([
  'WORKOUT_COUNT',
  'PERFORMED_SETS',
  'TOTAL_REPS',
  'WORKING_EXTERNAL_VOLUME',
  'TOTAL_DURATION',
  'TOTAL_DISTANCE',
]);

export type ProgressOverviewMetric = z.infer<
  typeof progressOverviewMetricSchema
>;

export const progressOverviewBucketSchema = z.enum(['DAY', 'WEEK', 'MONTH']);
export type ProgressOverviewBucket = z.infer<
  typeof progressOverviewBucketSchema
>;

export const progressOverviewQuerySchema = z
  .object({
    from: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    to: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    metric: z.preprocess(
      emptyQueryToUndefined,
      progressOverviewMetricSchema.optional(),
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

export type ProgressOverviewQuery = z.infer<typeof progressOverviewQuerySchema>;

export type ProgressOverviewQueryParseErrorCode =
  | 'PROGRESS_INVALID_METRIC'
  | 'PROGRESS_INVALID_FROM_DATE'
  | 'PROGRESS_INVALID_TO_DATE'
  | 'PROGRESS_INVALID_DATE_RANGE'
  | 'PROGRESS_INVALID_QUERY';

export type ProgressOverviewQueryParseResult =
  | { ok: true; data: ProgressOverviewQuery }
  | {
      ok: false;
      code: ProgressOverviewQueryParseErrorCode;
      message: string;
    };

function overviewQueryErrorMessage(
  code: ProgressOverviewQueryParseErrorCode,
): string {
  switch (code) {
    case 'PROGRESS_INVALID_METRIC':
      return 'Métrique de dashboard invalide.';
    case 'PROGRESS_INVALID_FROM_DATE':
      return 'Date de début invalide.';
    case 'PROGRESS_INVALID_TO_DATE':
      return 'Date de fin invalide.';
    case 'PROGRESS_INVALID_DATE_RANGE':
      return 'La date de début doit être antérieure ou égale à la date de fin.';
    case 'PROGRESS_INVALID_QUERY':
      return 'Paramètres de dashboard invalides.';
  }
}

export function parseProgressOverviewQuery(
  raw: unknown,
): ProgressOverviewQueryParseResult {
  const result = progressOverviewQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  for (const issue of result.error.issues) {
    if (issue.message === 'PROGRESS_INVALID_DATE_RANGE') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_DATE_RANGE',
        message: overviewQueryErrorMessage('PROGRESS_INVALID_DATE_RANGE'),
      };
    }
    const path = issue.path[0];
    if (path === 'metric') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_METRIC',
        message: overviewQueryErrorMessage('PROGRESS_INVALID_METRIC'),
      };
    }
    if (path === 'from') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_FROM_DATE',
        message: overviewQueryErrorMessage('PROGRESS_INVALID_FROM_DATE'),
      };
    }
    if (path === 'to') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_TO_DATE',
        message: overviewQueryErrorMessage('PROGRESS_INVALID_TO_DATE'),
      };
    }
  }
  return {
    ok: false,
    code: 'PROGRESS_INVALID_QUERY',
    message: overviewQueryErrorMessage('PROGRESS_INVALID_QUERY'),
  };
}

/** Nombre de jours inclusifs entre deux YYYY-MM-DD. */
export function countInclusiveLocalDays(from: string, to: string): number {
  const start = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const end = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  );
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function resolveProgressOverviewBucket(
  from: string,
  to: string,
): ProgressOverviewBucket {
  const days = countInclusiveLocalDays(from, to);
  if (days <= PROGRESS_OVERVIEW_DAY_BUCKET_MAX_DAYS) {
    return 'DAY';
  }
  if (days <= PROGRESS_OVERVIEW_WEEK_BUCKET_MAX_DAYS) {
    return 'WEEK';
  }
  return 'MONTH';
}

/** Lundi de la semaine ISO-like (lundi→dimanche) contenant la date locale. */
export function startOfWeekMonday(localDate: string): string {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay(); // 0=dimanche
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function endOfWeekSunday(localDate: string): string {
  return addLocalDateDays(startOfWeekMonday(localDate), 6);
}

export function startOfMonth(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

export function endOfMonth(localDate: string): string {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${localDate.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}

export function bucketBoundsForDate(
  localDate: string,
  bucket: ProgressOverviewBucket,
): { periodStart: string; periodEnd: string } {
  switch (bucket) {
    case 'DAY':
      return { periodStart: localDate, periodEnd: localDate };
    case 'WEEK':
      return {
        periodStart: startOfWeekMonday(localDate),
        periodEnd: endOfWeekSunday(localDate),
      };
    case 'MONTH':
      return {
        periodStart: startOfMonth(localDate),
        periodEnd: endOfMonth(localDate),
      };
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

export function nextBucketStart(
  periodStart: string,
  bucket: ProgressOverviewBucket,
): string {
  switch (bucket) {
    case 'DAY':
      return addLocalDateDays(periodStart, 1);
    case 'WEEK':
      return addLocalDateDays(periodStart, 7);
    case 'MONTH':
      return addLocalDateMonths(startOfMonth(periodStart), 1);
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

export type ProgressOverviewTotalsComputed = {
  workoutCount: number;
  exerciseCount: number;
  uniqueExerciseCount: number;
  performedSetCount: number;
  totalReps: number;
  workingExternalVolumeKg: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  failureSetCount: number;
};

export type ProgressOverviewSessionInput = {
  workoutSessionId: string;
  localDate: string;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  exercises: Array<{
    sourceExerciseId: string | null;
    exerciseNameSnapshot: string;
    measurementType: string;
    sets: WorkoutMetricsSessionInput['exercises'][number]['sets'];
  }>;
};

export function emptyProgressOverviewTotals(): ProgressOverviewTotalsComputed {
  return {
    workoutCount: 0,
    exerciseCount: 0,
    uniqueExerciseCount: 0,
    performedSetCount: 0,
    totalReps: 0,
    workingExternalVolumeKg: 0,
    totalDurationSeconds: 0,
    totalDistanceMeters: 0,
    failureSetCount: 0,
  };
}

export function computeProgressOverviewTotals(
  sessions: ProgressOverviewSessionInput[],
): ProgressOverviewTotalsComputed {
  const totals = emptyProgressOverviewTotals();
  const uniqueExercises = new Set<string>();

  for (const session of sessions) {
    totals.workoutCount += 1;
    const metrics = computeWorkoutMetrics({
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      exercises: session.exercises.map((exercise) => ({
        measurementType: exercise.measurementType,
        sets: exercise.sets,
      })),
    });

    totals.exerciseCount += metrics.performedExerciseCount;
    totals.performedSetCount += metrics.sets.performed;
    totals.totalReps += metrics.performance.totalReps;
    totals.workingExternalVolumeKg =
      Math.round(
        (totals.workingExternalVolumeKg +
          metrics.performance.workingExternalVolumeKg) *
          1_000_000,
      ) / 1_000_000;
    totals.totalDurationSeconds += metrics.performance.totalDurationSeconds;
    totals.totalDistanceMeters =
      Math.round(
        (totals.totalDistanceMeters +
          metrics.performance.totalDistanceMeters) *
          1_000_000,
      ) / 1_000_000;
    totals.failureSetCount += metrics.sets.reachedFailure;

    for (const exercise of session.exercises) {
      const hasPerformed = exercise.sets.some((set) =>
        set.status === 'COMPLETED' ||
        set.status === 'PARTIAL' ||
        set.status === 'FAILED',
      );
      if (hasPerformed && exercise.sourceExerciseId) {
        uniqueExercises.add(exercise.sourceExerciseId);
      }
    }
  }

  totals.uniqueExerciseCount = uniqueExercises.size;
  return totals;
}

export function computeAverageWorkoutsPerWeek(
  workoutCount: number,
  from: string | null,
  to: string | null,
): number | null {
  if (!from || !to) {
    return null;
  }
  const days = countInclusiveLocalDays(from, to);
  if (days < 7) {
    return null;
  }
  return workoutCount / (days / 7);
}

export type ProgressOverviewPointComputed = {
  periodStart: string;
  periodEnd: string;
  workoutCount: number;
  performedSetCount: number;
  totalReps: number;
  workingExternalVolumeKg: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
};

function emptyPoint(
  periodStart: string,
  periodEnd: string,
): ProgressOverviewPointComputed {
  return {
    periodStart,
    periodEnd,
    workoutCount: 0,
    performedSetCount: 0,
    totalReps: 0,
    workingExternalVolumeKg: 0,
    totalDurationSeconds: 0,
    totalDistanceMeters: 0,
  };
}

export function buildProgressOverviewTimeline(
  sessions: ProgressOverviewSessionInput[],
  rangeFrom: string,
  rangeTo: string,
  bucket: ProgressOverviewBucket,
): ProgressOverviewPointComputed[] {
  const firstBounds = bucketBoundsForDate(rangeFrom, bucket);
  const lastBounds = bucketBoundsForDate(rangeTo, bucket);

  const points: ProgressOverviewPointComputed[] = [];
  let cursor = firstBounds.periodStart;
  while (cursor <= lastBounds.periodStart) {
    const bounds = bucketBoundsForDate(cursor, bucket);
    points.push(emptyPoint(bounds.periodStart, bounds.periodEnd));
    cursor = nextBucketStart(bounds.periodStart, bucket);
  }

  const indexByStart = new Map(
    points.map((point, index) => [point.periodStart, index]),
  );

  for (const session of sessions) {
    const bounds = bucketBoundsForDate(session.localDate, bucket);
    const index = indexByStart.get(bounds.periodStart);
    if (index == null) {
      continue;
    }
    const point = points[index]!;
    const metrics = computeWorkoutMetrics({
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      exercises: session.exercises.map((exercise) => ({
        measurementType: exercise.measurementType,
        sets: exercise.sets,
      })),
    });
    point.workoutCount += 1;
    point.performedSetCount += metrics.sets.performed;
    point.totalReps += metrics.performance.totalReps;
    point.workingExternalVolumeKg =
      Math.round(
        (point.workingExternalVolumeKg +
          metrics.performance.workingExternalVolumeKg) *
          1_000_000,
      ) / 1_000_000;
    point.totalDurationSeconds += metrics.performance.totalDurationSeconds;
    point.totalDistanceMeters =
      Math.round(
        (point.totalDistanceMeters + metrics.performance.totalDistanceMeters) *
          1_000_000,
      ) / 1_000_000;
  }

  return points;
}

export type ProgressOverviewComparisonComputed = {
  workoutCountChangePercent: number | null;
  performedSetCountChangePercent: number | null;
  workingExternalVolumeChangePercent: number | null;
};

export function percentageChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function computeProgressOverviewComparison(
  current: ProgressOverviewTotalsComputed,
  previous: ProgressOverviewTotalsComputed,
): ProgressOverviewComparisonComputed {
  return {
    workoutCountChangePercent: percentageChange(
      current.workoutCount,
      previous.workoutCount,
    ),
    performedSetCountChangePercent: percentageChange(
      current.performedSetCount,
      previous.performedSetCount,
    ),
    workingExternalVolumeChangePercent: percentageChange(
      current.workingExternalVolumeKg,
      previous.workingExternalVolumeKg,
    ),
  };
}

/** Période précédente de même durée inclusive, immédiatement antérieure. */
export function resolvePreviousRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const days = countInclusiveLocalDays(from, to);
  const prevTo = addLocalDateDays(from, -1);
  const prevFrom = addLocalDateDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export type ProgressTopExerciseComputed = {
  exerciseId: string;
  exerciseName: string;
  workoutCount: number;
  performedSetCount: number;
  latestPerformedOn: string;
};

export function computeProgressTopExercises(
  sessions: ProgressOverviewSessionInput[],
  limit = PROGRESS_OVERVIEW_TOP_EXERCISES_LIMIT,
): ProgressTopExerciseComputed[] {
  type Acc = {
    exerciseId: string;
    exerciseName: string;
    workoutIds: Set<string>;
    performedSetCount: number;
    latestPerformedOn: string;
    latestStartedAt: string;
  };

  const byExercise = new Map<string, Acc>();

  const sorted = [...sessions].sort((a, b) => {
    if (a.localDate !== b.localDate) {
      return a.localDate < b.localDate ? -1 : 1;
    }
    const aStart =
      typeof a.startedAt === 'string'
        ? a.startedAt
        : a.startedAt?.toISOString() ?? '';
    const bStart =
      typeof b.startedAt === 'string'
        ? b.startedAt
        : b.startedAt?.toISOString() ?? '';
    return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
  });

  for (const session of sorted) {
    const startedAt =
      typeof session.startedAt === 'string'
        ? session.startedAt
        : session.startedAt?.toISOString() ?? '';

    for (const exercise of session.exercises) {
      if (!exercise.sourceExerciseId) {
        continue;
      }
      const performedSets = exercise.sets.filter(
        (set) =>
          set.status === 'COMPLETED' ||
          set.status === 'PARTIAL' ||
          set.status === 'FAILED',
      );
      if (performedSets.length === 0) {
        continue;
      }

      let acc = byExercise.get(exercise.sourceExerciseId);
      if (!acc) {
        acc = {
          exerciseId: exercise.sourceExerciseId,
          exerciseName: exercise.exerciseNameSnapshot,
          workoutIds: new Set(),
          performedSetCount: 0,
          latestPerformedOn: session.localDate,
          latestStartedAt: startedAt,
        };
        byExercise.set(exercise.sourceExerciseId, acc);
      }

      acc.workoutIds.add(session.workoutSessionId);
      acc.performedSetCount += performedSets.length;

      if (
        session.localDate > acc.latestPerformedOn ||
        (session.localDate === acc.latestPerformedOn &&
          startedAt >= acc.latestStartedAt)
      ) {
        acc.latestPerformedOn = session.localDate;
        acc.latestStartedAt = startedAt;
        acc.exerciseName = exercise.exerciseNameSnapshot;
      }
    }
  }

  return [...byExercise.values()]
    .map((acc) => ({
      exerciseId: acc.exerciseId,
      exerciseName: acc.exerciseName,
      workoutCount: acc.workoutIds.size,
      performedSetCount: acc.performedSetCount,
      latestPerformedOn: acc.latestPerformedOn,
    }))
    .sort((a, b) => {
      if (a.workoutCount !== b.workoutCount) {
        return b.workoutCount - a.workoutCount;
      }
      if (a.performedSetCount !== b.performedSetCount) {
        return b.performedSetCount - a.performedSetCount;
      }
      return a.exerciseId < b.exerciseId ? -1 : 1;
    })
    .slice(0, limit);
}

export function resolveAvailableOverviewMetrics(
  totals: ProgressOverviewTotalsComputed,
): ProgressOverviewMetric[] {
  const available: ProgressOverviewMetric[] = ['WORKOUT_COUNT'];
  if (totals.performedSetCount > 0) {
    available.push('PERFORMED_SETS');
  }
  if (totals.totalReps > 0) {
    available.push('TOTAL_REPS');
  }
  if (totals.workingExternalVolumeKg > 0) {
    available.push('WORKING_EXTERNAL_VOLUME');
  }
  if (totals.totalDurationSeconds > 0) {
    available.push('TOTAL_DURATION');
  }
  if (totals.totalDistanceMeters > 0) {
    available.push('TOTAL_DISTANCE');
  }
  return available;
}

export function resolveDefaultOverviewMetric(
  available: ProgressOverviewMetric[],
  requested?: ProgressOverviewMetric,
): ProgressOverviewMetric {
  if (requested && available.includes(requested)) {
    return requested;
  }
  return 'WORKOUT_COUNT';
}

export function pointValueForMetric(
  point: ProgressOverviewPointComputed,
  metric: ProgressOverviewMetric,
): number {
  switch (metric) {
    case 'WORKOUT_COUNT':
      return point.workoutCount;
    case 'PERFORMED_SETS':
      return point.performedSetCount;
    case 'TOTAL_REPS':
      return point.totalReps;
    case 'WORKING_EXTERNAL_VOLUME':
      return point.workingExternalVolumeKg;
    case 'TOTAL_DURATION':
      return point.totalDurationSeconds;
    case 'TOTAL_DISTANCE':
      return point.totalDistanceMeters;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

// Réexport utile pour les tests / UI qui importent depuis ce module.
export { addLocalDateDays, addLocalDateMonths };
