import type { WorkoutMetrics } from '@gym-companion/shared';

/**
 * Métriques agrégées de séance (jalon 4.2).
 *
 * Calculées à la demande depuis les snapshots — pas de table matérialisée.
 *
 * Volume externe = actualWeightKg × actualReps pour WEIGHT_REPS uniquement.
 * BODYWEIGHT / ASSISTED / REPS_ONLY / DURATION / DISTANCE / WEIGHT_DURATION
 * ne contribuent pas au volume externe.
 *
 * Warmup : inclus dans totalExternalVolumeKg, exclu de workingExternalVolumeKg.
 * PARTIAL / FAILED peuvent contribuer avec leurs valeurs réelles.
 * Records 4.1 restent plus stricts (COMPLETED + hors WARMUP uniquement).
 */

export type WorkoutMetricsSetInput = {
  setType: string;
  status: string;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  reachedFailure: boolean;
};

export type WorkoutMetricsExerciseInput = {
  measurementType: string;
  sets: WorkoutMetricsSetInput[];
};

export type WorkoutMetricsSessionInput = {
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  exercises: WorkoutMetricsExerciseInput[];
};

const PERFORMED_STATUSES = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

export function isPerformedSetStatus(status: string): boolean {
  return PERFORMED_STATUSES.has(status);
}

export function isProcessedSetStatus(status: string): boolean {
  return status !== 'PENDING';
}

/** Types de mesure contribuant au volume externe kg×reps. */
export function contributesToExternalVolume(measurementType: string): boolean {
  return measurementType === 'WEIGHT_REPS';
}

export function contributesToTotalReps(measurementType: string): boolean {
  return (
    measurementType === 'WEIGHT_REPS' ||
    measurementType === 'BODYWEIGHT_REPS' ||
    measurementType === 'ASSISTED_BODYWEIGHT_REPS' ||
    measurementType === 'REPS_ONLY'
  );
}

function isFiniteNonNegative(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

/**
 * Stabilise l’accumulation flottante kg×reps (charges décimales Prisma).
 */
export function addExternalVolumeKg(
  accumulator: number,
  weightKg: number,
  reps: number,
): number {
  return Math.round((accumulator + weightKg * reps) * 1_000_000) / 1_000_000;
}

export function setExternalVolumeContributionKg(
  measurementType: string,
  set: Pick<
    WorkoutMetricsSetInput,
    'status' | 'actualWeightKg' | 'actualReps'
  >,
): number {
  if (!isPerformedSetStatus(set.status)) {
    return 0;
  }
  if (!contributesToExternalVolume(measurementType)) {
    return 0;
  }
  if (
    !isFiniteNonNegative(set.actualWeightKg) ||
    !isFiniteNonNegative(set.actualReps)
  ) {
    return 0;
  }
  return addExternalVolumeKg(0, set.actualWeightKg, set.actualReps);
}

function toTimestampMs(value: string | Date | null): number | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Durée écoulée brute (completedAt − startedAt) en secondes.
 * Ce n’est pas une durée active nette (pauses non historisées).
 */
export function computeElapsedDurationSeconds(input: {
  startedAt: string | Date | null;
  completedAt: string | Date | null;
}): number | null {
  const start = toTimestampMs(input.startedAt);
  const end = toTimestampMs(input.completedAt);
  if (start == null || end == null || end < start) {
    return null;
  }
  return Math.floor((end - start) / 1000);
}

/**
 * Calcule les métriques d’une séance à partir de ses snapshots.
 * Indépendant du statut de séance (l’appelant décide de l’officialité).
 */
export function computeWorkoutMetrics(
  input: WorkoutMetricsSessionInput,
): WorkoutMetrics {
  let completed = 0;
  let partial = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let cancelled = 0;
  let warmup = 0;
  let working = 0;
  let reachedFailure = 0;

  let totalReps = 0;
  let totalExternalVolumeKg = 0;
  let workingExternalVolumeKg = 0;
  let totalDurationSeconds = 0;
  let totalDistanceMeters = 0;
  let performedExerciseCount = 0;

  for (const exercise of input.exercises) {
    let exercisePerformed = false;

    for (const set of exercise.sets) {
      if (set.setType === 'WARMUP') {
        warmup += 1;
      } else {
        working += 1;
      }

      switch (set.status) {
        case 'COMPLETED':
          completed += 1;
          break;
        case 'PARTIAL':
          partial += 1;
          break;
        case 'FAILED':
          failed += 1;
          break;
        case 'SKIPPED':
          skipped += 1;
          break;
        case 'PENDING':
          pending += 1;
          break;
        case 'CANCELLED':
          cancelled += 1;
          break;
        default:
          break;
      }

      if (!isPerformedSetStatus(set.status)) {
        continue;
      }

      exercisePerformed = true;

      if (set.reachedFailure) {
        reachedFailure += 1;
      }

      if (
        contributesToTotalReps(exercise.measurementType) &&
        isFiniteNonNegative(set.actualReps)
      ) {
        totalReps += set.actualReps;
      }

      if (
        contributesToExternalVolume(exercise.measurementType) &&
        isFiniteNonNegative(set.actualWeightKg) &&
        isFiniteNonNegative(set.actualReps)
      ) {
        totalExternalVolumeKg = addExternalVolumeKg(
          totalExternalVolumeKg,
          set.actualWeightKg,
          set.actualReps,
        );
        if (set.setType !== 'WARMUP') {
          workingExternalVolumeKg = addExternalVolumeKg(
            workingExternalVolumeKg,
            set.actualWeightKg,
            set.actualReps,
          );
        }
      }

      if (isFiniteNonNegative(set.actualDurationSeconds)) {
        totalDurationSeconds += set.actualDurationSeconds;
      }

      if (isFiniteNonNegative(set.actualDistanceMeters)) {
        totalDistanceMeters =
          Math.round(
            (totalDistanceMeters + set.actualDistanceMeters) * 1_000_000,
          ) / 1_000_000;
      }
    }

    if (exercisePerformed) {
      performedExerciseCount += 1;
    }
  }

  const total = completed + partial + failed + skipped + pending + cancelled;
  const performed = completed + partial + failed;
  const processed = total - pending;

  return {
    exerciseCount: input.exercises.length,
    performedExerciseCount,
    sets: {
      total,
      processed,
      performed,
      completed,
      partial,
      failed,
      skipped,
      pending,
      cancelled,
      warmup,
      working,
      reachedFailure,
    },
    performance: {
      totalReps,
      totalExternalVolumeKg,
      workingExternalVolumeKg,
      totalDurationSeconds,
      totalDistanceMeters,
    },
    elapsedDurationSeconds: computeElapsedDurationSeconds({
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    }),
  };
}

/** Métriques officielles : uniquement séances COMPLETED. */
export function resolveOfficialWorkoutMetrics(
  status: string,
  input: WorkoutMetricsSessionInput,
): WorkoutMetrics | null {
  if (status !== 'COMPLETED') {
    return null;
  }
  return computeWorkoutMetrics(input);
}
