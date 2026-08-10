import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

export const sharedWorkoutRoomQueryKeys = {
  all: ['shared-workouts'] as const,
  lists: () => [...sharedWorkoutRoomQueryKeys.all, 'list'] as const,
  list: (filters: { status?: SharedWorkoutRoomStatus } = {}) =>
    [...sharedWorkoutRoomQueryKeys.lists(), filters] as const,
  details: () => [...sharedWorkoutRoomQueryKeys.all, 'detail'] as const,
  detail: (roomId: string) =>
    [...sharedWorkoutRoomQueryKeys.details(), roomId] as const,
};
