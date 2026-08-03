import type {
  EquipmentTypeReference,
  ExerciseDetail,
  ExerciseListResponse,
  ExerciseMeasurementType,
  ExerciseSource,
  MuscleGroupReference,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export type ExerciseListQuery = {
  search?: string;
  muscleGroupId?: string;
  equipmentTypeId?: string;
  measurementType?: ExerciseMeasurementType;
  source?: ExerciseSource;
  favoriteOnly?: boolean;
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

export function buildExerciseListSearchParams(query: ExerciseListQuery): URLSearchParams {
  const params = new URLSearchParams();
  appendIfPresent(params, 'search', query.search);
  appendIfPresent(params, 'muscleGroupId', query.muscleGroupId);
  appendIfPresent(params, 'equipmentTypeId', query.equipmentTypeId);
  appendIfPresent(params, 'measurementType', query.measurementType);
  appendIfPresent(params, 'source', query.source);
  if (query.favoriteOnly === true) {
    params.set('favoriteOnly', 'true');
  }
  if (query.includeArchived === true) {
    params.set('includeArchived', 'true');
  }
  appendIfPresent(params, 'cursor', query.cursor);
  appendIfPresent(params, 'limit', query.limit);
  return params;
}

export async function listExercises(
  query: ExerciseListQuery = {},
): Promise<ExerciseListResponse> {
  const params = buildExerciseListSearchParams(query);
  const suffix = params.toString();
  return apiFetch<ExerciseListResponse>(
    `/api/v1/exercises${suffix ? `?${suffix}` : ''}`,
  );
}

export async function getExercise(exerciseId: string): Promise<ExerciseDetail> {
  const response = await apiFetch<{ data: ExerciseDetail }>(
    `/api/v1/exercises/${exerciseId}`,
  );
  return response.data;
}

export async function listMuscleGroups(): Promise<MuscleGroupReference[]> {
  const response = await apiFetch<{ data: MuscleGroupReference[] }>(
    '/api/v1/reference/muscle-groups',
  );
  return response.data;
}

export async function listEquipmentTypes(): Promise<EquipmentTypeReference[]> {
  const response = await apiFetch<{ data: EquipmentTypeReference[] }>(
    '/api/v1/reference/equipment-types',
  );
  return response.data;
}
