import { queryOptions } from '@tanstack/react-query';

import {
  getExerciseProgress,
  getExerciseStrength,
  getLastWorkingSets,
  getProgressOverview,
  type ExerciseProgressFilters,
  type ExerciseStrengthFilters,
  type ProgressOverviewFilters,
} from './progress-api';
import { progressQueryKeys } from './progress-query-keys';

export function exerciseProgressQueryOptions(
  exerciseId: string,
  filters: ExerciseProgressFilters,
) {
  return queryOptions({
    queryKey: progressQueryKeys.exercise(exerciseId, filters),
    queryFn: () => getExerciseProgress(exerciseId, filters),
    enabled: Boolean(exerciseId),
  });
}

export function exerciseStrengthQueryOptions(
  exerciseId: string,
  filters: ExerciseStrengthFilters,
) {
  return queryOptions({
    queryKey: progressQueryKeys.exerciseStrength(exerciseId, filters),
    queryFn: () => getExerciseStrength(exerciseId, filters),
    enabled: Boolean(exerciseId),
  });
}

export function progressOverviewQueryOptions(filters: ProgressOverviewFilters) {
  return queryOptions({
    queryKey: progressQueryKeys.overview(filters),
    queryFn: () => getProgressOverview(filters),
  });
}

export function lastWorkingSetsQueryOptions(exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds)].sort();
  return queryOptions({
    queryKey: progressQueryKeys.lastWorkingSets(ids),
    queryFn: () => getLastWorkingSets(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}
