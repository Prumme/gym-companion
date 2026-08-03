import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { ExerciseDetail } from '@gym-companion/shared';
import type {
  CreateExerciseInput,
  UpdateExerciseInput,
} from '@gym-companion/validation';

import {
  archiveExercise,
  createExercise,
  restoreExercise,
  updateExercise,
} from '../api/exercise-api';
import { exerciseQueryKeys } from '../api/exercise-query-keys';
import type { ExerciseListFilters } from '../api/exercise-query-options';
import {
  mergeDetailIntoListItem,
  removeExerciseFromInfiniteData,
  updateExerciseInInfiniteData,
  type ExerciseInfiniteData,
} from '../lib/exercise-cache';

function readListFilters(queryKey: QueryKey): ExerciseListFilters | undefined {
  const filters = queryKey[2];
  if (filters && typeof filters === 'object') {
    return filters as ExerciseListFilters;
  }
  return undefined;
}

function setExerciseDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  detail: ExerciseDetail,
) {
  queryClient.setQueryData(exerciseQueryKeys.detail(detail.id), detail);
}

function invalidateExerciseLists(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: exerciseQueryKeys.lists() });
}

function patchListsAfterArchiveOrUpdate(
  queryClient: ReturnType<typeof useQueryClient>,
  detail: ExerciseDetail,
  mode: 'archive' | 'update' | 'restore',
) {
  for (const query of queryClient.getQueryCache().findAll({
    queryKey: exerciseQueryKeys.lists(),
  })) {
    const filters = readListFilters(query.queryKey);
    queryClient.setQueryData<ExerciseInfiniteData>(query.queryKey, (current) => {
      if (!current) {
        return current;
      }

      if (mode === 'archive' && !filters?.includeArchived) {
        return removeExerciseFromInfiniteData(current, detail.id);
      }

      return updateExerciseInInfiniteData(current, detail.id, (item) =>
        mergeDetailIntoListItem(item, detail),
      );
    });
  }
}

export function useCreateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExerciseInput) => createExercise(input),
    onSuccess: (detail) => {
      setExerciseDetail(queryClient, detail);
      invalidateExerciseLists(queryClient);
    },
  });
}

export function useUpdateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      exerciseId,
      input,
    }: {
      exerciseId: string;
      input: UpdateExerciseInput;
    }) => updateExercise(exerciseId, input),
    onSuccess: (detail) => {
      setExerciseDetail(queryClient, detail);
      patchListsAfterArchiveOrUpdate(queryClient, detail, 'update');
      invalidateExerciseLists(queryClient);
    },
  });
}

export function useArchiveExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) => archiveExercise(exerciseId),
    onSuccess: (detail) => {
      setExerciseDetail(queryClient, detail);
      patchListsAfterArchiveOrUpdate(queryClient, detail, 'archive');
      // Les listes `includeArchived=true` non encore chargées restent cohérentes
      // via invalidation ciblée des listes.
      invalidateExerciseLists(queryClient);
    },
  });
}

export function useRestoreExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) => restoreExercise(exerciseId),
    onSuccess: (detail) => {
      setExerciseDetail(queryClient, detail);
      patchListsAfterArchiveOrUpdate(queryClient, detail, 'restore');
      invalidateExerciseLists(queryClient);
    },
  });
}
