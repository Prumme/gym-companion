import { queryOptions } from '@tanstack/react-query';

import {
  getActiveWorkoutSession,
  getWorkoutSessionDetail,
} from './workout-api';
import { workoutQueryKeys } from './workout-query-keys';

export function activeWorkoutQueryOptions() {
  return queryOptions({
    queryKey: workoutQueryKeys.active(),
    queryFn: () => getActiveWorkoutSession(),
  });
}

export function workoutDetailQueryOptions(workoutSessionId: string) {
  return queryOptions({
    queryKey: workoutQueryKeys.detail(workoutSessionId),
    queryFn: () => getWorkoutSessionDetail(workoutSessionId),
    enabled: Boolean(workoutSessionId),
  });
}
