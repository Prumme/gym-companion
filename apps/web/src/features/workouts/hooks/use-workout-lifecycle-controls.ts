import type { WorkoutSessionDetail } from '@gym-companion/shared';

import type { ApiRequestError } from '@/lib/api/client';

import {
  usePauseWorkoutSessionMutation,
  useResumeWorkoutSessionMutation,
} from './use-workout-mutations';

export function useWorkoutLifecycleControls(
  session: WorkoutSessionDetail,
  options: {
    onVersionConflict: () => void;
    onPaused?: () => void;
    onResumed?: () => void;
  },
) {
  const pauseMutation = usePauseWorkoutSessionMutation(session.id);
  const resumeMutation = useResumeWorkoutSessionMutation(session.id);

  async function pause() {
    try {
      await pauseMutation.mutateAsync({ expectedVersion: session.version });
      options.onPaused?.();
    } catch (error) {
      const apiError = error as ApiRequestError;
      if (
        apiError.code === 'WORKOUT_VERSION_CONFLICT' ||
        apiError.code === 'WORKOUT_INVALID_STATUS_TRANSITION'
      ) {
        options.onVersionConflict();
      }
    }
  }

  async function resume() {
    try {
      await resumeMutation.mutateAsync({ expectedVersion: session.version });
      options.onResumed?.();
    } catch (error) {
      const apiError = error as ApiRequestError;
      if (
        apiError.code === 'WORKOUT_VERSION_CONFLICT' ||
        apiError.code === 'WORKOUT_INVALID_STATUS_TRANSITION'
      ) {
        options.onVersionConflict();
      }
    }
  }

  return {
    pause,
    resume,
    pausePending: pauseMutation.isPending,
    resumePending: resumeMutation.isPending,
    offline: false,
    pauseError: pauseMutation.error,
    resumeError: resumeMutation.error,
  };
}
