import { queryOptions } from '@tanstack/react-query';

import {
  getSharedWorkoutRoom,
  listReceivedInvitations,
  listRoomInvitations,
  listSharedWorkoutRooms,
  type SharedWorkoutInvitationListFilters,
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

export function sharedWorkoutRoomInvitationsQueryOptions(
  roomId: string,
  filters: SharedWorkoutInvitationListFilters = {},
) {
  return queryOptions({
    queryKey: sharedWorkoutRoomQueryKeys.roomInvitations(roomId, {
      status: filters.status,
    }),
    queryFn: () => listRoomInvitations(roomId, filters),
    enabled: Boolean(roomId),
  });
}

export function sharedWorkoutReceivedInvitationsQueryOptions(
  filters: SharedWorkoutInvitationListFilters = {},
) {
  return queryOptions({
    queryKey: sharedWorkoutRoomQueryKeys.receivedInvitations({
      status: filters.status,
    }),
    queryFn: () => listReceivedInvitations(filters),
  });
}
