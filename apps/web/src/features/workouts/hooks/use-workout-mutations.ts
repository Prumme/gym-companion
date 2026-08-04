import type {
  UpdateWorkoutSetResult,
  WorkoutLifecycleResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CancelWorkoutSessionInput,
  CompleteWorkoutSessionInput,
  CreateWorkoutSessionInput,
  PauseWorkoutSessionInput,
  ResumeWorkoutSessionInput,
  UpdateWorkoutSetInput,
} from '@gym-companion/validation';

import {
  cancelWorkoutSession,
  completeWorkoutSession,
  createWorkoutSession,
  pauseWorkoutSession,
  resumeWorkoutSession,
  updateWorkoutSet,
} from '../api/workout-api';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { applyUpdateWorkoutSetResult } from '../lib/workout-cache';

function applyLifecycleResult(
  queryClient: ReturnType<typeof useQueryClient>,
  result: WorkoutLifecycleResult,
) {
  const session = result.workoutSession;
  const isInProgress =
    session.status === 'ACTIVE' || session.status === 'PAUSED';

  queryClient.setQueryData(
    workoutQueryKeys.active(),
    isInProgress ? session : null,
  );
  queryClient.setQueryData(workoutQueryKeys.detail(session.id), session);
}

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

export function usePauseWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PauseWorkoutSessionInput) =>
      pauseWorkoutSession(workoutSessionId, input),
    onSuccess: (result) => applyLifecycleResult(queryClient, result),
  });
}

export function useResumeWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResumeWorkoutSessionInput) =>
      resumeWorkoutSession(workoutSessionId, input),
    onSuccess: (result) => applyLifecycleResult(queryClient, result),
  });
}

export function useCompleteWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteWorkoutSessionInput) =>
      completeWorkoutSession(workoutSessionId, input),
    onSuccess: (result) => applyLifecycleResult(queryClient, result),
  });
}

export function useCancelWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelWorkoutSessionInput) =>
      cancelWorkoutSession(workoutSessionId, input),
    onSuccess: (result) => applyLifecycleResult(queryClient, result),
  });
}
