import type {
  ExerciseProgressMetric,
  ExerciseProgressResponse,
  ProgressOverviewMetric,
  ProgressOverviewResponse,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export type ExerciseProgressFilters = {
  metric?: ExerciseProgressMetric;
  from?: string;
  to?: string;
  equipmentId?: string;
};

export type ProgressOverviewFilters = {
  metric?: ProgressOverviewMetric;
  from?: string;
  to?: string;
};

function toSearchParams(
  filters: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

export async function getExerciseProgress(
  exerciseId: string,
  filters: ExerciseProgressFilters = {},
): Promise<ExerciseProgressResponse> {
  const suffix = toSearchParams(filters);
  const response = await apiFetch<{ data: ExerciseProgressResponse }>(
    `/api/v1/progress/exercises/${exerciseId}${suffix ? `?${suffix}` : ''}`,
  );
  return response.data;
}

export async function getProgressOverview(
  filters: ProgressOverviewFilters = {},
): Promise<ProgressOverviewResponse> {
  const suffix = toSearchParams(filters);
  const response = await apiFetch<{ data: ProgressOverviewResponse }>(
    `/api/v1/progress/overview${suffix ? `?${suffix}` : ''}`,
  );
  return response.data;
}
