import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  getActiveWorkoutSession,
  getWorkoutSessionDetail,
  listWorkoutHistory,
} from './workout-api';
import {
  workoutQueryKeys,
  type WorkoutHistoryFilters,
} from './workout-query-keys';
import { isAuthError, isNetworkError } from '../offline/network';
import {
  getLocalActiveSnapshot,
  getSnapshot,
  listPendingTerminalSnapshots,
  persistServerSnapshot,
} from '../offline/store';

export function workoutHistoryInfiniteQueryOptions(
  filters: WorkoutHistoryFilters,
) {
  return infiniteQueryOptions({
    queryKey: workoutQueryKeys.history(filters),
    queryFn: ({ pageParam }) =>
      listWorkoutHistory({
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

export function pendingTerminalLocalQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: workoutQueryKeys.pendingTerminalLocal(),
    queryFn: async () => {
      if (!userId) {
        return [];
      }
      return (await listPendingTerminalSnapshots(userId)) ?? [];
    },
    enabled: Boolean(userId),
  });
}

export function activeWorkoutQueryOptions(
  getUserId: () => string | null = () => null,
) {
  return queryOptions({
    queryKey: workoutQueryKeys.active(),
    queryFn: async ({ client }): Promise<WorkoutSessionDetail | null> => {
      const userId = getUserId();
      try {
        const data = await getActiveWorkoutSession();
        if (userId && data) {
          await persistServerSnapshot(userId, data);
        }
        client.setQueryData(workoutQueryKeys.activeFromLocal(), false);
        return data;
      } catch (error) {
        if (isAuthError(error)) {
          throw error;
        }
        const status = (error as { status?: number }).status;
        if (status === 403 || status === 404) {
          throw error;
        }
        if (isNetworkError(error) && userId) {
          const local = await getLocalActiveSnapshot(userId);
          if (local) {
            client.setQueryData(workoutQueryKeys.activeFromLocal(), true);
            return local.data;
          }
        }
        throw error;
      }
    },
  });
}

export function workoutDetailQueryOptions(
  workoutSessionId: string,
  getUserId: () => string | null = () => null,
) {
  return queryOptions({
    queryKey: workoutQueryKeys.detail(workoutSessionId),
    queryFn: async ({ client }): Promise<WorkoutSessionDetail> => {
      const userId = getUserId();
      try {
        const data = await getWorkoutSessionDetail(workoutSessionId);
        if (userId) {
          await persistServerSnapshot(userId, data);
        }
        client.setQueryData(
          workoutQueryKeys.detailFromLocal(workoutSessionId),
          false,
        );
        return data;
      } catch (error) {
        if (isAuthError(error)) {
          throw error;
        }
        const status = (error as { status?: number }).status;
        if (status === 403 || status === 404) {
          throw error;
        }
        if (isNetworkError(error) && userId) {
          const local = await getSnapshot(userId, workoutSessionId);
          if (local) {
            client.setQueryData(
              workoutQueryKeys.detailFromLocal(workoutSessionId),
              true,
            );
            return local.data;
          }
        }
        throw error;
      }
    },
    enabled: Boolean(workoutSessionId),
  });
}
