import type { LoadRecommendation } from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export async function getLoadRecommendation(
  workoutTemplateExerciseId: string,
): Promise<LoadRecommendation> {
  const response = await apiFetch<{ data: LoadRecommendation }>(
    `/api/v1/coaching/workout-template-exercises/${encodeURIComponent(workoutTemplateExerciseId)}/load-recommendation`,
  );
  return response.data;
}
