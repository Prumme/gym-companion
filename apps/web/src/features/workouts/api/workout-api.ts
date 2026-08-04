import type {
  UpdateWorkoutSetResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import type {
  CreateWorkoutSessionInput,
  UpdateWorkoutSetInput,
} from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export async function getActiveWorkoutSession(): Promise<WorkoutSessionDetail | null> {
  const response = await apiFetch<{ data: WorkoutSessionDetail | null }>(
    '/api/v1/workouts/active',
  );
  return response.data;
}

export async function getWorkoutSessionDetail(
  workoutSessionId: string,
): Promise<WorkoutSessionDetail> {
  const response = await apiFetch<{ data: WorkoutSessionDetail }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}`,
  );
  return response.data;
}

export async function createWorkoutSession(
  input: CreateWorkoutSessionInput,
): Promise<WorkoutSessionDetail> {
  const response = await apiFetch<{ data: WorkoutSessionDetail }>(
    '/api/v1/workouts',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function updateWorkoutSet(
  workoutSessionId: string,
  sessionExerciseId: string,
  workoutSetId: string,
  input: UpdateWorkoutSetInput,
): Promise<UpdateWorkoutSetResult> {
  const response = await apiFetch<{ data: UpdateWorkoutSetResult }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/exercises/${encodeURIComponent(sessionExerciseId)}/sets/${encodeURIComponent(workoutSetId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}
