import type {
  ExerciseProgressMetric,
  ExerciseProgressResponse,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export type ExerciseProgressFilters = {
  metric?: ExerciseProgressMetric;
  from?: string;
  to?: string;
  equipmentId?: string;
};

function toSearchParams(filters: ExerciseProgressFilters): string {
  const params = new URLSearchParams();
  if (filters.metric) {
    params.set('metric', filters.metric);
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  if (filters.equipmentId) {
    params.set('equipmentId', filters.equipmentId);
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
