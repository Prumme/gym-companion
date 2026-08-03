import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  getExercise,
  listEquipmentTypes,
  listExercises,
  listMuscleGroups,
  type ExerciseListQuery,
} from './exercise-api';
import { exerciseQueryKeys } from './exercise-query-keys';

const REFERENCE_STALE_TIME_MS = 30 * 60 * 1000;

export type ExerciseListFilters = Omit<ExerciseListQuery, 'cursor' | 'limit'>;

export function exerciseListInfiniteQueryOptions(filters: ExerciseListFilters) {
  return infiniteQueryOptions({
    queryKey: exerciseQueryKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listExercises({
        ...filters,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? (lastPage.pagination.nextCursor ?? undefined)
        : undefined,
  });
}

export function exerciseDetailQueryOptions(exerciseId: string) {
  return queryOptions({
    queryKey: exerciseQueryKeys.detail(exerciseId),
    queryFn: () => getExercise(exerciseId),
  });
}

export function muscleGroupsQueryOptions() {
  return queryOptions({
    queryKey: exerciseQueryKeys.muscleGroups(),
    queryFn: listMuscleGroups,
    staleTime: REFERENCE_STALE_TIME_MS,
  });
}

export function equipmentTypesQueryOptions() {
  return queryOptions({
    queryKey: exerciseQueryKeys.equipmentTypes(),
    queryFn: listEquipmentTypes,
    staleTime: REFERENCE_STALE_TIME_MS,
  });
}
