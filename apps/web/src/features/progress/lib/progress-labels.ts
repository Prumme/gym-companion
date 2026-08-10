import type { ExerciseProgressMetric } from '@gym-companion/shared';

export const EXERCISE_PROGRESS_METRIC_LABELS: Record<
  ExerciseProgressMetric,
  string
> = {
  MAX_WEIGHT: 'Charge maximale',
  MAX_REPS: 'Répétitions maximales',
  WORKING_EXTERNAL_VOLUME: 'Volume de travail',
  TOTAL_REPS: 'Répétitions totales',
  MAX_DURATION: 'Durée maximale',
  TOTAL_DURATION: 'Durée totale',
  MAX_DISTANCE: 'Distance maximale',
  TOTAL_DISTANCE: 'Distance totale',
};

export function getExerciseProgressMetricLabel(
  metric: ExerciseProgressMetric,
): string {
  return EXERCISE_PROGRESS_METRIC_LABELS[metric] ?? metric;
}
