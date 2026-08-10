import type {
  UpdateWorkoutSetResult,
  WorkoutLifecycleResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CancelWorkoutSessionInput,
  CompleteWorkoutSessionInput,
  CreateWorkoutSessionInput,
  PauseWorkoutSessionInput,
  ResumeWorkoutSessionInput,
  UpdateWorkoutSetInput,
} from '@gym-companion/validation';

import type { ApiRequestError } from '@/lib/api/client';

import {
  cancelWorkoutSession,
  completeWorkoutSession,
  createWorkoutSession,
  pauseWorkoutSession,
  resumeWorkoutSession,
  updateWorkoutSet,
} from '../api/workout-api';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { personalRecordQueryKeys } from '@/features/personal-records/api/personal-record-query-keys';
import { progressQueryKeys } from '@/features/progress/api/progress-query-keys';
import { applyUpdateWorkoutSetResult } from '../lib/workout-cache';
import { createClientCommandId } from '../offline/command-id';
import { enqueueWorkoutCommand } from '../offline/enqueue';
import {
  isAuthError,
  isBusinessRejectError,
  isConflictError,
  isNetworkError,
} from '../offline/network';
import { persistServerSnapshot } from '../offline/store';
import { scheduleWorkoutSync } from '../offline/sync-engine';
import type { UpdateWorkoutSetCommandPayload } from '../offline/types';

function applyLifecycleToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  session: WorkoutSessionDetail,
) {
  const isInProgress =
    session.status === 'ACTIVE' || session.status === 'PAUSED';
  queryClient.setQueryData(
    workoutQueryKeys.active(),
    isInProgress ? session : null,
  );
  queryClient.setQueryData(workoutQueryKeys.detail(session.id), session);
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    void queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.historyLists(),
    });
    void queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.pendingTerminalLocal(),
    });
  }
  if (session.status === 'COMPLETED') {
    void queryClient.invalidateQueries({
      queryKey: personalRecordQueryKeys.all,
    });
    void queryClient.invalidateQueries({
      queryKey: progressQueryKeys.all,
    });
  }
}

/** Exposé pour tests d’invalidation des records (jalon 4.1). */
export function applyLifecycleToCacheForTest(
  queryClient: QueryClient,
  session: WorkoutSessionDetail,
) {
  applyLifecycleToCache(queryClient, session);
}

function shouldEnqueueOffline(error: unknown): boolean {
  if (
    isAuthError(error) ||
    isConflictError(error) ||
    isBusinessRejectError(error)
  ) {
    return false;
  }
  return isNetworkError(error);
}

async function resolveUserId(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<string> {
  const me = queryClient.getQueryData<{ data: { id: string } }>(['me']);
  if (me?.data?.id) {
    return me.data.id;
  }
  throw Object.assign(new Error('Utilisateur non chargé.'), {
    code: 'UNAUTHORIZED',
    status: 401,
  }) as ApiRequestError;
}

export function useCreateWorkoutSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkoutSessionInput) => createWorkoutSession(input),
    onSuccess: async (detail: WorkoutSessionDetail) => {
      queryClient.setQueryData(workoutQueryKeys.active(), detail);
      queryClient.setQueryData(workoutQueryKeys.detail(detail.id), detail);
      const userId = queryClient.getQueryData<{ data: { id: string } }>([
        'me',
      ])?.data?.id;
      if (userId) {
        await persistServerSnapshot(userId, detail);
      }
    },
  });
}

export function useUpdateWorkoutSetMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      sessionExerciseId: string;
      workoutSetId: string;
      input: Omit<UpdateWorkoutSetInput, 'clientCommandId'>;
    }) => {
      const userId = await resolveUserId(queryClient);
      const clientCommandId = createClientCommandId();
      const input: UpdateWorkoutSetInput = {
        ...args.input,
        clientCommandId,
      };

      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw Object.assign(new Error('offline'), { status: 0 });
        }
        const result = await updateWorkoutSet(
          workoutSessionId,
          args.sessionExerciseId,
          args.workoutSetId,
          input,
        );
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
        const patched = queryClient.getQueryData<WorkoutSessionDetail | null>(
          workoutQueryKeys.active(),
        );
        if (patched) {
          void persistServerSnapshot(userId, patched);
        }
        return { kind: 'server' as const, result };
      } catch (error) {
        if (!shouldEnqueueOffline(error)) {
          throw error;
        }
        const payload: UpdateWorkoutSetCommandPayload = {
          sessionExerciseId: args.sessionExerciseId,
          workoutSetId: args.workoutSetId,
          status: args.input.status,
          actualWeightKg: args.input.actualWeightKg,
          actualReps: args.input.actualReps,
          actualDurationSeconds: args.input.actualDurationSeconds,
          actualDistanceMeters: args.input.actualDistanceMeters,
          actualRir: args.input.actualRir,
          actualRpe: args.input.actualRpe,
          reachedFailure: args.input.reachedFailure,
          notes: args.input.notes ?? null,
        };
        const current =
          queryClient.getQueryData<WorkoutSessionDetail | null>(
            workoutQueryKeys.active(),
          ) ??
          queryClient.getQueryData<WorkoutSessionDetail>(
            workoutQueryKeys.detail(workoutSessionId),
          );
        const { snapshot } = await enqueueWorkoutCommand({
          userId,
          workoutSessionId,
          type: 'UPDATE_WORKOUT_SET',
          payload,
          baseSession: current ?? undefined,
        });
        scheduleWorkoutSync(userId, workoutSessionId, {
          onSessionUpdated: (session) => {
            if (session) applyLifecycleToCache(queryClient, session);
          },
        });
        const workoutSet = snapshot.data.exercises
          .flatMap((exercise) => exercise.sets)
          .find((set) => set.id === args.workoutSetId);
        if (!workoutSet) {
          throw new Error('Série introuvable après application locale.');
        }
        const synthetic: UpdateWorkoutSetResult = {
          workoutSet,
          workoutSessionVersion: snapshot.localVersion,
        };
        return { kind: 'offline' as const, result: synthetic, snapshot };
      }
    },
    onSuccess: (value) => {
      if (value.kind === 'server') {
        const patch = (current: WorkoutSessionDetail | null | undefined) => {
          if (!current) return current;
          return applyUpdateWorkoutSetResult(current, value.result);
        };
        queryClient.setQueryData(workoutQueryKeys.active(), patch);
        queryClient.setQueryData(
          workoutQueryKeys.detail(workoutSessionId),
          patch,
        );
        return;
      }
      applyLifecycleToCache(queryClient, value.snapshot.data);
    },
  });
}

async function runLifecycleMutation(args: {
  queryClient: ReturnType<typeof useQueryClient>;
  workoutSessionId: string;
  type: 'PAUSE_WORKOUT' | 'RESUME_WORKOUT' | 'COMPLETE_WORKOUT' | 'CANCEL_WORKOUT';
  payload: unknown;
  onlineCall: (clientCommandId: string) => Promise<WorkoutLifecycleResult>;
}): Promise<WorkoutLifecycleResult> {
  const userId = await resolveUserId(args.queryClient);
  const clientCommandId = createClientCommandId();

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw Object.assign(new Error('offline'), { status: 0 });
    }
    const result = await args.onlineCall(clientCommandId);
    await persistServerSnapshot(userId, result.workoutSession);
    return result;
  } catch (error) {
    if (!shouldEnqueueOffline(error)) {
      throw error;
    }
    const current =
      args.queryClient.getQueryData<WorkoutSessionDetail | null>(
        workoutQueryKeys.active(),
      ) ??
      args.queryClient.getQueryData<WorkoutSessionDetail>(
        workoutQueryKeys.detail(args.workoutSessionId),
      );
    const { snapshot } = await enqueueWorkoutCommand({
      userId,
      workoutSessionId: args.workoutSessionId,
      type: args.type,
      payload: args.payload,
      baseSession: current ?? undefined,
    });
    scheduleWorkoutSync(userId, args.workoutSessionId, {
      onSessionUpdated: (session) => {
        if (session) {
          applyLifecycleToCache(args.queryClient, session);
        } else {
          args.queryClient.setQueryData(workoutQueryKeys.active(), null);
        }
      },
    });
    return {
      workoutSession: snapshot.data,
      workoutSessionVersion: snapshot.localVersion,
    };
  }
}

export function usePauseWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PauseWorkoutSessionInput) =>
      runLifecycleMutation({
        queryClient,
        workoutSessionId,
        type: 'PAUSE_WORKOUT',
        payload: {},
        onlineCall: (clientCommandId) =>
          pauseWorkoutSession(workoutSessionId, {
            expectedVersion: input.expectedVersion,
            clientCommandId,
          }),
      }),
    onSuccess: (result) =>
      applyLifecycleToCache(queryClient, result.workoutSession),
  });
}

export function useResumeWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResumeWorkoutSessionInput) =>
      runLifecycleMutation({
        queryClient,
        workoutSessionId,
        type: 'RESUME_WORKOUT',
        payload: {},
        onlineCall: (clientCommandId) =>
          resumeWorkoutSession(workoutSessionId, {
            expectedVersion: input.expectedVersion,
            clientCommandId,
          }),
      }),
    onSuccess: (result) =>
      applyLifecycleToCache(queryClient, result.workoutSession),
  });
}

export function useCompleteWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteWorkoutSessionInput) =>
      runLifecycleMutation({
        queryClient,
        workoutSessionId,
        type: 'COMPLETE_WORKOUT',
        payload: { notes: input.notes ?? null },
        onlineCall: (clientCommandId) =>
          completeWorkoutSession(workoutSessionId, {
            expectedVersion: input.expectedVersion,
            notes: input.notes,
            clientCommandId,
          }),
      }),
    onSuccess: (result) =>
      applyLifecycleToCache(queryClient, result.workoutSession),
  });
}

export function useCancelWorkoutSessionMutation(workoutSessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelWorkoutSessionInput) =>
      runLifecycleMutation({
        queryClient,
        workoutSessionId,
        type: 'CANCEL_WORKOUT',
        payload: {
          reason: input.reason ?? null,
          keepRecordedData: input.keepRecordedData ?? true,
        },
        onlineCall: (clientCommandId) =>
          cancelWorkoutSession(workoutSessionId, {
            expectedVersion: input.expectedVersion,
            reason: input.reason,
            keepRecordedData: input.keepRecordedData,
            clientCommandId,
          }),
      }),
    onSuccess: (result) =>
      applyLifecycleToCache(queryClient, result.workoutSession),
  });
}
