import type {
  DecideLoadRecommendationResult,
  LoadRecommendation,
  LoadRecommendationDecisionListResponse,
} from '@gym-companion/shared';
import type { DecideLoadRecommendationInput } from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export async function getLoadRecommendation(
  workoutTemplateExerciseId: string,
): Promise<LoadRecommendation> {
  const response = await apiFetch<{ data: LoadRecommendation }>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation`,
  );
  return response.data;
}

export async function decideLoadRecommendation(
  workoutTemplateExerciseId: string,
  input: DecideLoadRecommendationInput,
): Promise<DecideLoadRecommendationResult> {
  const response = await apiFetch<{ data: DecideLoadRecommendationResult }>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation/decision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function listLoadRecommendationDecisions(
  workoutTemplateExerciseId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<LoadRecommendationDecisionListResponse> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit != null) search.set('limit', String(params.limit));
  const suffix = search.toString();
  return apiFetch<LoadRecommendationDecisionListResponse>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation-decisions${suffix ? `?${suffix}` : ''}`,
  );
}
