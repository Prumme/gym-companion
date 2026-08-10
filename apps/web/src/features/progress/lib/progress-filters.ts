import type { ExerciseProgressMetric } from '@gym-companion/shared';
import {
  addLocalDateDays,
  addLocalDateMonths,
  isValidLocalDateString,
} from '@gym-companion/validation';

import {
  formatPersonalRecordDistance,
  formatPersonalRecordDuration,
  formatPersonalRecordWeight,
} from '@/features/personal-records/lib/personal-record-labels';
import { formatWorkoutVolume } from '@/features/workouts/lib/workout-metrics-format';
import { todayLocalDateString } from '@/features/programs/lib/schedule-utils';

export type ProgressPeriodPreset =
  | '30d'
  | '3m'
  | '6m'
  | '1y'
  | 'all'
  | 'custom';

export type ProgressUrlFilters = {
  metric?: ExerciseProgressMetric;
  from?: string;
  to?: string;
  period: ProgressPeriodPreset;
};

const METRICS = new Set<string>([
  'MAX_WEIGHT',
  'MAX_REPS',
  'WORKING_EXTERNAL_VOLUME',
  'TOTAL_REPS',
  'MAX_DURATION',
  'TOTAL_DURATION',
  'MAX_DISTANCE',
  'TOTAL_DISTANCE',
]);

export function parseProgressMetricParam(
  value: string | null,
): ExerciseProgressMetric | undefined {
  if (!value || !METRICS.has(value)) {
    return undefined;
  }
  return value as ExerciseProgressMetric;
}

export function parseOptionalLocalDateParam(
  value: string | null,
): string | undefined {
  if (!value || !isValidLocalDateString(value)) {
    return undefined;
  }
  return value;
}

export function resolvePresetRange(
  preset: Exclude<ProgressPeriodPreset, 'custom' | 'all'>,
  today: string = todayLocalDateString(),
): { from: string; to: string } {
  switch (preset) {
    case '30d':
      return { from: addLocalDateDays(today, -29), to: today };
    case '3m':
      return { from: addLocalDateMonths(today, -3), to: today };
    case '6m':
      return { from: addLocalDateMonths(today, -6), to: today };
    case '1y':
      return { from: addLocalDateMonths(today, -12), to: today };
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function detectPeriodPreset(
  from: string | undefined,
  to: string | undefined,
  today: string = todayLocalDateString(),
): ProgressPeriodPreset {
  if (!from && !to) {
    return 'all';
  }
  if (!from || !to || to !== today) {
    return 'custom';
  }
  const presets: Array<Exclude<ProgressPeriodPreset, 'custom' | 'all'>> = [
    '30d',
    '3m',
    '6m',
    '1y',
  ];
  for (const preset of presets) {
    const range = resolvePresetRange(preset, today);
    if (range.from === from && range.to === to) {
      return preset;
    }
  }
  return 'custom';
}

/**
 * Parsing URL progression / dashboard / force.
 *
 * - aucun paramètre → défaut 3 mois ;
 * - `period=all` → tout l’historique (from/to absents), distinct du défaut ;
 * - `from`/`to` → preset détecté ou `custom`.
 */
export function parseProgressSearchParams(
  searchParams: URLSearchParams,
): ProgressUrlFilters {
  const metric = parseProgressMetricParam(searchParams.get('metric'));
  const periodParam = searchParams.get('period');

  if (periodParam === 'all') {
    return {
      metric,
      from: undefined,
      to: undefined,
      period: 'all',
    };
  }

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

export function buildProgressSearchParams(
  filters: ProgressUrlFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.metric) {
    params.set('metric', filters.metric);
  }
  if (filters.period === 'all') {
    // Sentinel explicite : distinct d’une URL vide (défaut 3 mois).
    params.set('period', 'all');
    return params;
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  return params;
}

export function formatProgressMetricValue(
  metric: ExerciseProgressMetric,
  value: number,
): string {
  switch (metric) {
    case 'MAX_WEIGHT':
      return formatPersonalRecordWeight(value);
    case 'WORKING_EXTERNAL_VOLUME':
      return formatWorkoutVolume(value);
    case 'MAX_REPS':
    case 'TOTAL_REPS':
      return `${value} répétition${value > 1 ? 's' : ''}`;
    case 'MAX_DURATION':
    case 'TOTAL_DURATION':
      return formatPersonalRecordDuration(value);
    case 'MAX_DISTANCE':
    case 'TOTAL_DISTANCE':
      return formatPersonalRecordDistance(value);
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

export function formatProgressAxisTick(
  metric: ExerciseProgressMetric,
  value: number,
): string {
  switch (metric) {
    case 'MAX_WEIGHT':
      return `${value}`;
    case 'WORKING_EXTERNAL_VOLUME':
      return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(
        value,
      );
    case 'MAX_REPS':
    case 'TOTAL_REPS':
      return `${value}`;
    case 'MAX_DURATION':
    case 'TOTAL_DURATION':
      if (value < 60) {
        return `${value}s`;
      }
      return `${Math.round(value / 60)}m`;
    case 'MAX_DISTANCE':
    case 'TOTAL_DISTANCE':
      if (value >= 1000) {
        return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / 1000)}km`;
      }
      return `${value}m`;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

/** Format axe X depuis YYYY-MM-DD sans conversion UTC décalante. */
export function formatProgressChartDate(
  localDate: string,
  mode: 'short' | 'month' | 'full' = 'short',
): string {
  const [year, month, day] = localDate.split('-').map(Number);
  if (!year || !month || !day) {
    return localDate;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (mode === 'month') {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
  if (mode === 'full') {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function formatProgressChange(
  absoluteChange: number | null,
  percentageChange: number | null,
  metric: ExerciseProgressMetric,
): string | null {
  if (absoluteChange == null) {
    return null;
  }
  const sign = absoluteChange > 0 ? '+' : '';
  const absLabel = `${sign}${formatProgressMetricValue(metric, absoluteChange)}`;
  if (percentageChange == null) {
    return absLabel;
  }
  const pctSign = percentageChange > 0 ? '+' : '';
  const pct = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(percentageChange);
  return `${absLabel} (${pctSign}${pct} %)`;
}
