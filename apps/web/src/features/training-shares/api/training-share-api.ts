import type {
  CreateTrainingShareResponse,
  ImportTrainingShareRequest,
  ImportTrainingShareResponse,
  TrainingSharePreviewResponse,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export async function createProgramShare(
  programId: string,
): Promise<CreateTrainingShareResponse> {
  const response = await apiFetch<{ data: CreateTrainingShareResponse }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/share`,
    { method: 'POST', body: '{}' },
  );
  return response.data;
}

export async function createWorkoutTemplateShare(
  programId: string,
  workoutTemplateId: string,
): Promise<CreateTrainingShareResponse> {
  const response = await apiFetch<{ data: CreateTrainingShareResponse }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/share`,
    { method: 'POST', body: '{}' },
  );
  return response.data;
}

export async function getSharePreview(
  token: string,
): Promise<TrainingSharePreviewResponse> {
  const response = await apiFetch<{ data: TrainingSharePreviewResponse }>(
    `/api/v1/shares/${encodeURIComponent(token)}`,
  );
  return response.data;
}

export async function importShare(
  token: string,
  body: ImportTrainingShareRequest = {},
): Promise<ImportTrainingShareResponse> {
  const response = await apiFetch<{ data: ImportTrainingShareResponse }>(
    `/api/v1/shares/${encodeURIComponent(token)}/import`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return response.data;
}

export function buildShareUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/share/${encodeURIComponent(token)}`;
}
