import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  ExerciseDetail,
  ExerciseListResponse,
  ExerciseUserPreference,
} from '@gym-companion/shared';
import type { UpdateExercisePreferenceInput } from '@gym-companion/validation';

import {
  resetExercisePreference,
  updateExercisePreference,
} from '../api/exercise-api';
import { exerciseQueryKeys } from '../api/exercise-query-keys';
import type { ExerciseListFilters } from '../api/exercise-query-options';
import {
  applyPreferenceToDetail,
  applyPreferenceToListItem,
  updateExerciseInInfiniteData,
  type ExerciseInfiniteData,
} from '../lib/exercise-cache';
import {
  DEFAULT_EXERCISE_USER_PREFERENCE,
} from '../lib/exercise-preference';

type ListQuerySnapshot = Array<[QueryKey, InfiniteData<ExerciseListResponse> | undefined]>;

type PreferenceMutationContext = {
  previousLists: ListQuerySnapshot;
  previousDetail: ExerciseDetail | undefined;
  previousPreference: ExerciseUserPreference | undefined;
};

function readListFilters(queryKey: QueryKey): ExerciseListFilters | undefined {
  const filters = queryKey[2];
  if (filters && typeof filters === 'object') {
    return filters as ExerciseListFilters;
  }
  return undefined;
}

function applyOptimisticPreference(
  queryClient: ReturnType<typeof useQueryClient>,
  exerciseId: string,
  preference: ExerciseUserPreference,
) {
  for (const query of queryClient.getQueryCache().findAll({
    queryKey: exerciseQueryKeys.lists(),
  })) {
    const filters = readListFilters(query.queryKey);
    queryClient.setQueryData<ExerciseInfiniteData>(query.queryKey, (current) => {
      if (!current) {
        return current;
      }
      return updateExerciseInInfiniteData(current, exerciseId, (item) => {
        if (filters?.favoriteOnly && !preference.isFavorite) {
          return null;
        }
        return applyPreferenceToListItem(item, preference);
      });
    });
  }

  queryClient.setQueryData<ExerciseDetail>(
    exerciseQueryKeys.detail(exerciseId),
    (current) => (current ? applyPreferenceToDetail(current, preference) : current),
  );

  queryClient.setQueryData<ExerciseUserPreference>(
    exerciseQueryKeys.preference(exerciseId),
    preference,
  );
}

function snapshotPreferenceCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  exerciseId: string,
): PreferenceMutationContext {
  return {
    previousLists: queryClient.getQueriesData<InfiniteData<ExerciseListResponse>>({
      queryKey: exerciseQueryKeys.lists(),
    }),
    previousDetail: queryClient.getQueryData<ExerciseDetail>(
      exerciseQueryKeys.detail(exerciseId),
    ),
    previousPreference: queryClient.getQueryData<ExerciseUserPreference>(
      exerciseQueryKeys.preference(exerciseId),
    ),
  };
}

function restorePreferenceCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  exerciseId: string,
  context: PreferenceMutationContext,
) {
  for (const [key, data] of context.previousLists) {
    queryClient.setQueryData(key, data);
  }
  if (context.previousDetail !== undefined) {
    queryClient.setQueryData(
      exerciseQueryKeys.detail(exerciseId),
      context.previousDetail,
    );
  }
  if (context.previousPreference !== undefined) {
    queryClient.setQueryData(
      exerciseQueryKeys.preference(exerciseId),
      context.previousPreference,
    );
  }
}

async function settlePreferenceCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  exerciseId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: exerciseQueryKeys.lists() }),
    queryClient.invalidateQueries({ queryKey: exerciseQueryKeys.detail(exerciseId) }),
    queryClient.invalidateQueries({
      queryKey: exerciseQueryKeys.preference(exerciseId),
    }),
  ]);
}

export function useUpdateExercisePreferenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      exerciseId,
      input,
    }: {
      exerciseId: string;
      input: UpdateExercisePreferenceInput;
      optimisticPreference: ExerciseUserPreference;
    }) => updateExercisePreference(exerciseId, input),
    onMutate: async ({ exerciseId, optimisticPreference }) => {
      await queryClient.cancelQueries({ queryKey: exerciseQueryKeys.all });
      const context = snapshotPreferenceCaches(queryClient, exerciseId);
      applyOptimisticPreference(queryClient, exerciseId, optimisticPreference);
      return context;
    },
    onError: (_error, variables, context) => {
      if (context) {
        restorePreferenceCaches(queryClient, variables.exerciseId, context);
      }
    },
    onSuccess: (preference, { exerciseId }) => {
      applyOptimisticPreference(queryClient, exerciseId, preference);
    },
    onSettled: async (_data, _error, { exerciseId }) => {
      await settlePreferenceCaches(queryClient, exerciseId);
    },
  });
}

export function useResetExercisePreferenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exerciseId: string) => resetExercisePreference(exerciseId),
    onMutate: async (exerciseId) => {
      await queryClient.cancelQueries({ queryKey: exerciseQueryKeys.all });
      const context = snapshotPreferenceCaches(queryClient, exerciseId);
      applyOptimisticPreference(
        queryClient,
        exerciseId,
        DEFAULT_EXERCISE_USER_PREFERENCE,
      );
      return context;
    },
    onError: (_error, exerciseId, context) => {
      if (context) {
        restorePreferenceCaches(queryClient, exerciseId, context);
      }
    },
    onSuccess: (_data, exerciseId) => {
      applyOptimisticPreference(
        queryClient,
        exerciseId,
        DEFAULT_EXERCISE_USER_PREFERENCE,
      );
    },
    onSettled: async (_data, _error, exerciseId) => {
      await settlePreferenceCaches(queryClient, exerciseId);
    },
  });
}
