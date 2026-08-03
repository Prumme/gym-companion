import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  getActiveProgram,
  getProgram,
  getProgramSchedule,
  listPrograms,
  type ProgramListQuery,
} from './program-api';
import { programQueryKeys } from './program-query-keys';

export type ProgramListFilters = Omit<ProgramListQuery, 'cursor' | 'limit'>;

export function programListInfiniteQueryOptions(filters: ProgramListFilters) {
  return infiniteQueryOptions({
    queryKey: programQueryKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listPrograms({
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

export function programDetailQueryOptions(programId: string) {
  return queryOptions({
    queryKey: programQueryKeys.detail(programId),
    queryFn: () => getProgram(programId),
  });
}

export function activeProgramQueryOptions() {
  return queryOptions({
    queryKey: programQueryKeys.active(),
    queryFn: () => getActiveProgram(),
  });
}

export function programScheduleQueryOptions(programId: string) {
  return queryOptions({
    queryKey: programQueryKeys.schedule(programId),
    queryFn: () => getProgramSchedule(programId),
    enabled: Boolean(programId),
  });
}
