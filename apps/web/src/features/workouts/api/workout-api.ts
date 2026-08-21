import type {
  UpdateWorkoutSetResult,
  WorkoutHistoryListResponse,
  WorkoutLifecycleResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import type {
  CancelWorkoutSessionInput,
  CompleteWorkoutSessionInput,
  CreateWorkoutSessionInput,
  PauseWorkoutSessionInput,
  ReplaceWorkoutSessionExerciseInput,
  ResumeWorkoutSessionInput,
  UpdateWorkoutSetInput,
  WorkoutHistoryQuery,
} from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export type WorkoutHistoryListQuery = Partial<WorkoutHistoryQuery> & {
  cursor?: string;
  limit?: number;
};

function appendIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value === undefined || value === '') {
    return;
  }
  params.set(key, String(value));
}

export function buildWorkoutHistorySearchParams(
  query: WorkoutHistoryListQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  appendIfPresent(params, 'status', query.status);
  appendIfPresent(params, 'from', query.from);
  appendIfPresent(params, 'to', query.to);
  appendIfPresent(params, 'programId', query.programId);
  appendIfPresent(params, 'workoutTemplateId', query.workoutTemplateId);
  appendIfPresent(params, 'cursor', query.cursor);
  appendIfPresent(params, 'limit', query.limit);
  return params;
}

export async function listWorkoutHistory(
  query: WorkoutHistoryListQuery = {},
): Promise<WorkoutHistoryListResponse> {
  const params = buildWorkoutHistorySearchParams(query);
  const suffix = params.toString();
  return apiFetch<WorkoutHistoryListResponse>(
    `/api/v1/workouts${suffix ? `?${suffix}` : ''}`,
  );
}

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

export async function replaceWorkoutSessionExercise(
  workoutSessionId: string,
  sessionExerciseId: string,
  input: ReplaceWorkoutSessionExerciseInput,
): Promise<WorkoutSessionDetail> {
  const response = await apiFetch<{ data: WorkoutSessionDetail }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/exercises/${encodeURIComponent(sessionExerciseId)}/exercise`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function pauseWorkoutSession(
  workoutSessionId: string,
  input: PauseWorkoutSessionInput,
): Promise<WorkoutLifecycleResult> {
  const response = await apiFetch<{ data: WorkoutLifecycleResult }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/pause`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function resumeWorkoutSession(
  workoutSessionId: string,
  input: ResumeWorkoutSessionInput,
): Promise<WorkoutLifecycleResult> {
  const response = await apiFetch<{ data: WorkoutLifecycleResult }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/resume`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function completeWorkoutSession(
  workoutSessionId: string,
  input: CompleteWorkoutSessionInput,
): Promise<WorkoutLifecycleResult> {
  const response = await apiFetch<{ data: WorkoutLifecycleResult }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function cancelWorkoutSession(
  workoutSessionId: string,
  input: CancelWorkoutSessionInput,
): Promise<WorkoutLifecycleResult> {
  const response = await apiFetch<{ data: WorkoutLifecycleResult }>(
    `/api/v1/workouts/${encodeURIComponent(workoutSessionId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}
