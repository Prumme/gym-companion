import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkoutSessionInput } from '@gym-companion/validation';

import { createWorkoutSession } from '../api/workout-api';
import { workoutQueryKeys } from '../api/workout-query-keys';

export function useCreateWorkoutSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkoutSessionInput) => createWorkoutSession(input),
    onSuccess: (detail: WorkoutSessionDetail) => {
      queryClient.setQueryData(workoutQueryKeys.active(), detail);
      queryClient.setQueryData(workoutQueryKeys.detail(detail.id), detail);
    },
  });
}
