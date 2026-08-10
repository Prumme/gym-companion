import type {
  SharedWorkoutRoomInvitationStatus,
  SharedWorkoutRoomStatus,
} from '@gym-companion/shared';

export const sharedWorkoutRoomQueryKeys = {
  all: ['shared-workouts'] as const,
  lists: () => [...sharedWorkoutRoomQueryKeys.all, 'list'] as const,
  list: (filters: { status?: SharedWorkoutRoomStatus } = {}) =>
    [...sharedWorkoutRoomQueryKeys.lists(), filters] as const,
  details: () => [...sharedWorkoutRoomQueryKeys.all, 'detail'] as const,
  detail: (roomId: string) =>
    [...sharedWorkoutRoomQueryKeys.details(), roomId] as const,
  myWorkoutSession: (roomId: string) =>
    [...sharedWorkoutRoomQueryKeys.all, 'my-workout-session', roomId] as const,
  roomInvitations: (roomId: string, filters: { status?: SharedWorkoutRoomInvitationStatus } = {}) =>
    [...sharedWorkoutRoomQueryKeys.all, 'room-invitations', roomId, filters] as const,
  receivedInvitations: (
    filters: { status?: SharedWorkoutRoomInvitationStatus } = {},
  ) =>
    [...sharedWorkoutRoomQueryKeys.all, 'received-invitations', filters] as const,
};
