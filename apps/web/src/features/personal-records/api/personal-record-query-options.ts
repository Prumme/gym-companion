import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import {
  listExercisePersonalRecords,
  listPersonalRecords,
  type PersonalRecordsListQuery,
} from './personal-records-api';
import { personalRecordQueryKeys } from './personal-record-query-keys';

export function personalRecordsInfiniteQueryOptions(
  filters: PersonalRecordsListQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: personalRecordQueryKeys.list(filters),
    queryFn: ({ pageParam }) =>
      listPersonalRecords({
        ...filters,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
  });
}

export function exercisePersonalRecordsQueryOptions(exerciseId: string) {
  return queryOptions({
    queryKey: personalRecordQueryKeys.exercise(exerciseId),
    queryFn: () => listExercisePersonalRecords(exerciseId),
  });
}
