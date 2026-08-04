import { isValidLocalDateString } from '@gym-companion/validation';

import type { WorkoutHistoryFilters } from '../api/workout-query-keys';

export type WorkoutHistoryStatusFilterValue =
  | 'ALL'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkoutHistoryUrlFilters = {
  status: WorkoutHistoryStatusFilterValue;
  from?: string;
  to?: string;
};

export function parseWorkoutHistoryStatusParam(
  value: string | null,
): WorkoutHistoryStatusFilterValue {
  if (value === 'COMPLETED' || value === 'CANCELLED') {
    return value;
  }
  return 'ALL';
}

export function parseOptionalLocalDateParam(
  value: string | null,
): string | undefined {
  if (!value || !isValidLocalDateString(value)) {
    return undefined;
  }
  return value;
}

export function parseWorkoutHistorySearchParams(
  searchParams: URLSearchParams,
): WorkoutHistoryUrlFilters {
  const from = parseOptionalLocalDateParam(searchParams.get('from'));
  const toRaw = parseOptionalLocalDateParam(searchParams.get('to'));
  const status = parseWorkoutHistoryStatusParam(searchParams.get('status'));
  const to =
    from && toRaw && from > toRaw ? undefined : toRaw;

  return { status, from, to };
}

export function toWorkoutHistoryApiFilters(
  filters: WorkoutHistoryUrlFilters,
): WorkoutHistoryFilters {
  return {
    status: filters.status === 'ALL' ? undefined : filters.status,
    from: filters.from,
    to: filters.to,
  };
}

export function countActiveWorkoutHistoryFilters(
  filters: WorkoutHistoryUrlFilters,
): number {
  let count = 0;
  if (filters.status !== 'ALL') {
    count += 1;
  }
  if (filters.from) {
    count += 1;
  }
  if (filters.to) {
    count += 1;
  }
  return count;
}

export function buildWorkoutHistorySearchParamsFromFilters(
  filters: WorkoutHistoryUrlFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== 'ALL') {
    params.set('status', filters.status);
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  return params;
}

export type WorkoutHistoryNavigationState = {
  fromHistory?: boolean;
  historySearch?: string;
};

export function resolveHistoryBackPath(
  state: unknown,
): string {
  const typed = state as WorkoutHistoryNavigationState | null;
  if (typed?.fromHistory) {
    const search = typed.historySearch ?? '';
    return `/workouts${search}`;
  }
  return '/workouts';
}
