import { queryOptions } from '@tanstack/react-query';

import { getLoadRecommendation } from './coaching-api';
import { coachingQueryKeys } from './coaching-query-keys';

export function loadRecommendationQueryOptions(
  workoutTemplateExerciseId: string,
) {
  return queryOptions({
    queryKey: coachingQueryKeys.loadRecommendation(workoutTemplateExerciseId),
    queryFn: () => getLoadRecommendation(workoutTemplateExerciseId),
    staleTime: 30_000,
  });
}
