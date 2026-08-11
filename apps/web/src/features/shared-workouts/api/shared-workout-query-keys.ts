import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

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
  equipmentCoordination: (roomId: string) =>
    [...sharedWorkoutRoomQueryKeys.all, 'equipment-coordination', roomId] as const,
  myEquipment: (roomId: string) =>
    [...sharedWorkoutRoomQueryKeys.all, 'my-equipment', roomId] as const,
  workoutSessionContext: (workoutSessionId: string) =>
    [
      ...sharedWorkoutRoomQueryKeys.all,
      'workout-session-context',
      workoutSessionId,
    ] as const,
};
