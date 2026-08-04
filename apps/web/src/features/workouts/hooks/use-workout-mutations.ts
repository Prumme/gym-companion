import type {
  UpdateWorkoutSetResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWorkoutSessionInput,
  UpdateWorkoutSetInput,
} from '@gym-companion/validation';

import { createWorkoutSession, updateWorkoutSet } from '../api/workout-api';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { applyUpdateWorkoutSetResult } from '../lib/workout-cache';

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

export function useUpdateWorkoutSetMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: {
      sessionExerciseId: string;
      workoutSetId: string;
      input: UpdateWorkoutSetInput;
    }) =>
      updateWorkoutSet(
        workoutSessionId,
        args.sessionExerciseId,
        args.workoutSetId,
        args.input,
      ),
    onSuccess: (result: UpdateWorkoutSetResult) => {
      const patch = (current: WorkoutSessionDetail | null | undefined) => {
        if (!current) {
          return current;
        }
        return applyUpdateWorkoutSetResult(current, result);
      };
      queryClient.setQueryData(workoutQueryKeys.active(), patch);
      queryClient.setQueryData(
        workoutQueryKeys.detail(workoutSessionId),
        patch,
      );
    },
  });
}
