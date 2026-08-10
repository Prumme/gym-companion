import type { ProgressOverviewMetric } from '@gym-companion/shared';
import { isValidLocalDateString } from '@gym-companion/validation';

import {
  buildProgressSearchParams,
  detectPeriodPreset,
  formatProgressChartDate,
  parseOptionalLocalDateParam,
  resolvePresetRange,
  type ProgressPeriodPreset,
} from './progress-filters';
import { todayLocalDateString } from '@/features/programs/lib/schedule-utils';
import {
  formatPersonalRecordDistance,
  formatPersonalRecordDuration,
} from '@/features/personal-records/lib/personal-record-labels';
import { formatWorkoutVolume } from '@/features/workouts/lib/workout-metrics-format';

const OVERVIEW_METRICS = new Set<string>([
  'WORKOUT_COUNT',
  'PERFORMED_SETS',
  'TOTAL_REPS',
  'WORKING_EXTERNAL_VOLUME',
  'TOTAL_DURATION',
  'TOTAL_DISTANCE',
]);

export type OverviewUrlFilters = {
  metric?: ProgressOverviewMetric;
  from?: string;
  to?: string;
  period: ProgressPeriodPreset;
};

export function parseOverviewMetricParam(
  value: string | null,
): ProgressOverviewMetric | undefined {
  if (!value || !OVERVIEW_METRICS.has(value)) {
    return undefined;
  }
  return value as ProgressOverviewMetric;
}

export function parseOverviewSearchParams(
  searchParams: URLSearchParams,
): OverviewUrlFilters {
  const metric = parseOverviewMetricParam(searchParams.get('metric'));
  const from = parseOptionalLocalDateParam(searchParams.get('from'));
  const toRaw = parseOptionalLocalDateParam(searchParams.get('to'));
  const to = from && toRaw && from > toRaw ? undefined : toRaw;
  const hasExplicitDates =
    searchParams.has('from') || searchParams.has('to');

  if (!hasExplicitDates) {
    const defaultRange = resolvePresetRange('3m');
    return {
      metric,
      from: defaultRange.from,
      to: defaultRange.to,
      period: '3m',
    };
  }

  return {
    metric,
    from,
    to,
    period: detectPeriodPreset(from, to),
  };
}

export function buildOverviewSearchParams(
  filters: OverviewUrlFilters,
): URLSearchParams {
  const params = buildProgressSearchParams({
    metric: undefined,
    from: filters.from,
    to: filters.to,
    period: filters.period,
  });
  if (filters.metric && filters.metric !== 'WORKOUT_COUNT') {
    params.set('metric', filters.metric);
  }
  return params;
}

export function formatOverviewMetricValue(
  metric: ProgressOverviewMetric,
  value: number,
): string {
  switch (metric) {
    case 'WORKOUT_COUNT':
      return `${value} séance${value > 1 ? 's' : ''}`;
    case 'PERFORMED_SETS':
      return `${value} série${value > 1 ? 's' : ''}`;
    case 'TOTAL_REPS':
      return `${value} répétition${value > 1 ? 's' : ''}`;
    case 'WORKING_EXTERNAL_VOLUME':
      return formatWorkoutVolume(value);
    case 'TOTAL_DURATION':
      return formatPersonalRecordDuration(value);
    case 'TOTAL_DISTANCE':
      return formatPersonalRecordDistance(value);
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

export function formatOverviewAxisTick(
  metric: ProgressOverviewMetric,
  value: number,
): string {
  switch (metric) {
    case 'WORKING_EXTERNAL_VOLUME':
      return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
        value,
      );
    case 'TOTAL_DURATION':
      if (value < 60) return `${value}s`;
      return `${Math.round(value / 60)}m`;
    case 'TOTAL_DISTANCE':
      if (value >= 1000) {
        return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1000)}km`;
      }
      return `${value}m`;
    default:
      return `${value}`;
  }
}

export function formatOverviewPeriodLabel(
  periodStart: string,
  periodEnd: string,
  bucket: 'DAY' | 'WEEK' | 'MONTH',
): string {
  if (bucket === 'DAY') {
    return formatProgressChartDate(periodStart, 'short');
  }
  if (bucket === 'MONTH') {
    return formatProgressChartDate(periodStart, 'month');
  }
  return `Sem. ${formatProgressChartDate(periodStart, 'short')}`;
}

export function formatOverviewComparisonPercent(
  value: number | null,
): string {
  if (value == null) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(value);
  return `${sign}${formatted} %`;
}

export function formatAverageWorkoutsPerWeek(value: number | null): string | null {
  if (value == null) {
    return null;
  }
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} séances / semaine`;
}

/** Garde pour tests / custom dates. */
export function isOverviewLocalDate(value: string): boolean {
  return isValidLocalDateString(value);
}

export { todayLocalDateString, resolvePresetRange };
