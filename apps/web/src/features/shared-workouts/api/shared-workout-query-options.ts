import { queryOptions } from '@tanstack/react-query';

import {
  getSharedWorkoutRoom,
  listSharedWorkoutRooms,
  type SharedWorkoutRoomListFilters,
} from './shared-workouts-api';
import { sharedWorkoutRoomQueryKeys } from './shared-workout-query-keys';

export function sharedWorkoutRoomsListQueryOptions(
  filters: SharedWorkoutRoomListFilters = {},
) {
  return queryOptions({
    queryKey: sharedWorkoutRoomQueryKeys.list({
      status: filters.status,
    }),
    queryFn: () => listSharedWorkoutRooms(filters),
  });
}

export function sharedWorkoutRoomDetailQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: sharedWorkoutRoomQueryKeys.detail(roomId),
    queryFn: () => getSharedWorkoutRoom(roomId),
    enabled: Boolean(roomId),
  });
}
