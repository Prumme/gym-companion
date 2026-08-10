import { queryOptions } from '@tanstack/react-query';

import {
  getExerciseProgress,
  type ExerciseProgressFilters,
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
