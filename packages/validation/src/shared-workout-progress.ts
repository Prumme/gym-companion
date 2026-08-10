/**
 * Shared 5.5 — progression partagée (sans performances).
 * Réutilise isProcessedSetStatus (Phase 4) : processed = status !== PENDING.
 * Warmup inclus dans les compteurs (indicateur d’avancement, pas de perf).
 */

import { isProcessedSetStatus } from './workout-metrics';

export type SharedProgressSetInput = {
  status: string;
};

export type SharedProgressExerciseInput = {
  exerciseNameSnapshot: string;
  sets: SharedProgressSetInput[];
};

export type SharedExerciseProgressSummary = {
  name: string;
  processedSetCount: number;
  totalSetCount: number;
};

export type SharedWorkoutProgressSummary = {
  processedSetCount: number;
  totalSetCount: number;
  processedExerciseCount: number;
  totalExerciseCount: number;
};

export { isProcessedSetStatus };

export function buildExerciseProgressSummary(
  exercise: SharedProgressExerciseInput,
): SharedExerciseProgressSummary {
  const totalSetCount = exercise.sets.length;
  const processedSetCount = exercise.sets.filter((set) =>
    isProcessedSetStatus(set.status),
  ).length;
  return {
    name: exercise.exerciseNameSnapshot,
    processedSetCount,
    totalSetCount,
  };
}

/**
 * Exercice « traité » = toutes ses séries sont processed.
 * Exercice sans série : totalExerciseCount l’inclut, processed seulement si 0 sets
 * (convention : 0/0 → considéré processed pour ne pas bloquer).
 */
export function isExerciseFullyProcessed(
  exercise: SharedProgressExerciseInput,
): boolean {
  if (exercise.sets.length === 0) return true;
  return exercise.sets.every((set) => isProcessedSetStatus(set.status));
}

export function buildWorkoutProgressSummary(
  exercises: SharedProgressExerciseInput[],
): SharedWorkoutProgressSummary {
  let processedSetCount = 0;
  let totalSetCount = 0;
  let processedExerciseCount = 0;

  for (const exercise of exercises) {
    totalSetCount += exercise.sets.length;
    processedSetCount += exercise.sets.filter((set) =>
      isProcessedSetStatus(set.status),
    ).length;
    if (isExerciseFullyProcessed(exercise)) {
      processedExerciseCount += 1;
    }
  }

  return {
    processedSetCount,
    totalSetCount,
    processedExerciseCount,
    totalExerciseCount: exercises.length,
  };
}

/** Ratio sûr pour barre de progression (évite NaN/Infinity). */
export function safeProgressRatio(
  processed: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, processed / total));
}
