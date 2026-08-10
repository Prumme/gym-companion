import type { ProgressOverviewMetric } from '@gym-companion/shared';

export const PROGRESS_OVERVIEW_METRIC_LABELS: Record<
  ProgressOverviewMetric,
  string
> = {
  WORKOUT_COUNT: 'Séances',
  PERFORMED_SETS: 'Séries réalisées',
  TOTAL_REPS: 'Répétitions',
  WORKING_EXTERNAL_VOLUME: 'Volume de travail',
  TOTAL_DURATION: 'Durée enregistrée',
  TOTAL_DISTANCE: 'Distance',
};

export function getProgressOverviewMetricLabel(
  metric: ProgressOverviewMetric,
): string {
  return PROGRESS_OVERVIEW_METRIC_LABELS[metric] ?? metric;
}
