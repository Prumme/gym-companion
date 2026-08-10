import { queryOptions } from '@tanstack/react-query';

import {
  getExerciseProgress,
  getExerciseStrength,
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
