import type { WorkoutMetrics } from '@gym-companion/shared';

import {
  formatPersonalRecordDistance,
  formatPersonalRecordDuration,
} from '@/features/personal-records/lib/personal-record-labels';

/** Volume externe en kg·rep (unités canoniques serveur). */
export function formatWorkoutVolume(kgRep: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(kgRep);
  return `${formatted} kg·rep`;
}

export function formatWorkoutReps(reps: number): string {
  return `${reps} répétition${reps > 1 ? 's' : ''}`;
}

export function formatWorkoutExerciseDuration(seconds: number): string {
  return formatPersonalRecordDuration(seconds);
}

export function formatWorkoutDistance(meters: number): string {
  return formatPersonalRecordDistance(meters);
}

export function formatWorkoutElapsedSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  return `${minutes} min`;
}

export type WorkoutMetricsDisplayFlags = {
  showReps: boolean;
  showVolume: boolean;
  showExerciseDuration: boolean;
  showDistance: boolean;
  showElapsed: boolean;
};

/**
 * Décide quelles métriques de performance sont pertinentes à afficher.
 * Les compteurs généraux (exercices / séries) restent toujours affichés.
 */
export function getWorkoutMetricsDisplayFlags(
  metrics: WorkoutMetrics,
): WorkoutMetricsDisplayFlags {
  const { performance, elapsedDurationSeconds } = metrics;
  return {
    showReps: performance.totalReps > 0,
    showVolume: performance.workingExternalVolumeKg > 0,
    showExerciseDuration: performance.totalDurationSeconds > 0,
    showDistance: performance.totalDistanceMeters > 0,
    showElapsed: elapsedDurationSeconds != null && elapsedDurationSeconds > 0,
  };
}
