import type { ProgramDetail, ProgramListResponse } from '@gym-companion/shared';
import type {
  AddWorkoutTemplateExerciseInput,
  CreateProgramInput,
  CreateWorkoutTemplateInput,
  CreateWorkoutTemplateSetInput,
  ReorderWorkoutTemplateExercisesInput,
  ReorderWorkoutTemplatesInput,
  ReorderWorkoutTemplateSetsInput,
  UpdateProgramInput,
  UpdateWorkoutTemplateExerciseInput,
  UpdateWorkoutTemplateInput,
  UpdateWorkoutTemplateSetInput,
} from '@gym-companion/validation';

import { apiFetch } from '@/lib/api/client';

export type ProgramListQuery = {
  includeArchived?: boolean;
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

export function buildProgramListSearchParams(
  query: ProgramListQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.includeArchived === true) {
    params.set('includeArchived', 'true');
  }
  appendIfPresent(params, 'cursor', query.cursor);
  appendIfPresent(params, 'limit', query.limit);
  return params;
}

export async function listPrograms(
  query: ProgramListQuery = {},
): Promise<ProgramListResponse> {
  const params = buildProgramListSearchParams(query);
  const suffix = params.toString();
  return apiFetch<ProgramListResponse>(
    `/api/v1/programs${suffix ? `?${suffix}` : ''}`,
  );
}

export async function getProgram(programId: string): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}`,
  );
  return response.data;
}

export async function createProgram(
  input: CreateProgramInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>('/api/v1/programs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateProgram(
  programId: string,
  input: UpdateProgramInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function archiveProgram(programId: string): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}`,
    { method: 'DELETE' },
  );
  return response.data;
}

export async function restoreProgram(programId: string): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/restore`,
    { method: 'POST' },
  );
  return response.data;
}

export async function createWorkoutTemplate(
  programId: string,
  input: CreateWorkoutTemplateInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function updateWorkoutTemplate(
  programId: string,
  workoutTemplateId: string,
  input: UpdateWorkoutTemplateInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function deleteWorkoutTemplate(
  programId: string,
  workoutTemplateId: string,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}`,
    { method: 'DELETE' },
  );
  return response.data;
}

export async function reorderWorkoutTemplates(
  programId: string,
  input: ReorderWorkoutTemplatesInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/order`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function addWorkoutTemplateExercise(
  programId: string,
  workoutTemplateId: string,
  input: AddWorkoutTemplateExerciseInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function updateWorkoutTemplateExercise(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
  input: UpdateWorkoutTemplateExerciseInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function removeWorkoutTemplateExercise(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}`,
    { method: 'DELETE' },
  );
  return response.data;
}

export async function reorderWorkoutTemplateExercises(
  programId: string,
  workoutTemplateId: string,
  input: ReorderWorkoutTemplateExercisesInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/order`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function createWorkoutTemplateSet(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
  input: CreateWorkoutTemplateSetInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}/sets`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function updateWorkoutTemplateSet(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
  setId: string,
  input: UpdateWorkoutTemplateSetInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}/sets/${encodeURIComponent(setId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function deleteWorkoutTemplateSet(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
  setId: string,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}/sets/${encodeURIComponent(setId)}`,
    { method: 'DELETE' },
  );
  return response.data;
}

export async function reorderWorkoutTemplateSets(
  programId: string,
  workoutTemplateId: string,
  templateExerciseId: string,
  input: ReorderWorkoutTemplateSetsInput,
): Promise<ProgramDetail> {
  const response = await apiFetch<{ data: ProgramDetail }>(
    `/api/v1/programs/${encodeURIComponent(programId)}/workout-templates/${encodeURIComponent(workoutTemplateId)}/exercises/${encodeURIComponent(templateExerciseId)}/sets/order`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}
