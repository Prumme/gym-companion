import type {
  ExerciseMeasurementType,
  ExerciseSource,
} from '@gym-companion/shared';

import type { ExerciseListFilters } from '../api/exercise-query-options';

const MEASUREMENT_TYPES = new Set<ExerciseMeasurementType>([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

function parseStrictBoolean(value: string | null): boolean {
  if (value === null || value === '') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return false;
}

function isMeasurementType(value: string): value is ExerciseMeasurementType {
  return MEASUREMENT_TYPES.has(value as ExerciseMeasurementType);
}

function isSource(value: string): value is ExerciseSource {
  return value === 'SYSTEM' || value === 'USER';
}

export function parseExerciseListSearchParams(
  params: URLSearchParams,
): ExerciseListFilters {
  const search = params.get('search')?.trim() || undefined;
  const muscleGroupId = params.get('muscleGroupId')?.trim() || undefined;
  const equipmentTypeId = params.get('equipmentTypeId')?.trim() || undefined;
  const measurementRaw = params.get('measurementType')?.trim() || undefined;
  const sourceRaw = params.get('source')?.trim() || undefined;

  return {
    search,
    muscleGroupId,
    equipmentTypeId,
    measurementType:
      measurementRaw && isMeasurementType(measurementRaw) ? measurementRaw : undefined,
    source: sourceRaw && isSource(sourceRaw) ? sourceRaw : undefined,
    favoriteOnly: parseStrictBoolean(params.get('favoriteOnly')) || undefined,
    includeArchived: parseStrictBoolean(params.get('includeArchived')) || undefined,
  };
}

/** Sérialise les filtres en omettant les valeurs par défaut pour une URL lisible. */
export function serializeExerciseListSearchParams(
  filters: ExerciseListFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters.muscleGroupId) {
    params.set('muscleGroupId', filters.muscleGroupId);
  }
  if (filters.equipmentTypeId) {
    params.set('equipmentTypeId', filters.equipmentTypeId);
  }
  if (filters.measurementType) {
    params.set('measurementType', filters.measurementType);
  }
  if (filters.source) {
    params.set('source', filters.source);
  }
  if (filters.favoriteOnly) {
    params.set('favoriteOnly', 'true');
  }
  if (filters.includeArchived) {
    params.set('includeArchived', 'true');
  }
  return params;
}

export function countActiveExerciseFilters(filters: ExerciseListFilters): number {
  let count = 0;
  if (filters.search?.trim()) count += 1;
  if (filters.muscleGroupId) count += 1;
  if (filters.equipmentTypeId) count += 1;
  if (filters.measurementType) count += 1;
  if (filters.source) count += 1;
  if (filters.favoriteOnly) count += 1;
  if (filters.includeArchived) count += 1;
  return count;
}

export function hasNonSearchFilters(filters: ExerciseListFilters): boolean {
  return Boolean(
    filters.muscleGroupId ||
      filters.equipmentTypeId ||
      filters.measurementType ||
      filters.source ||
      filters.favoriteOnly ||
      filters.includeArchived,
  );
}

export const EMPTY_EXERCISE_LIST_FILTERS: ExerciseListFilters = {};
