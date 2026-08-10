import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  cancelSharedWorkoutRoom,
  completeSharedWorkoutRoom,
  createSharedWorkoutRoom,
  startSharedWorkoutRoom,
  updateSharedWorkoutRoom,
} from '../api/shared-workouts-api';
import { sharedWorkoutRoomQueryKeys } from '../api/shared-workout-query-keys';

function invalidateRoomQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: sharedWorkoutRoomQueryKeys.lists(),
  });
  if (roomId) {
    void queryClient.invalidateQueries({
      queryKey: sharedWorkoutRoomQueryKeys.detail(roomId),
    });
  }
}

export function useCreateSharedWorkoutRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSharedWorkoutRoom,
    onSuccess: () => {
      invalidateRoomQueries(queryClient);
    },
  });
}

export function useUpdateSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      updateSharedWorkoutRoom(roomId, input),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
    },
  });
}

export function useStartSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      startSharedWorkoutRoom(roomId, clientCommandId),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
    },
  });
}

export function useCompleteSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      completeSharedWorkoutRoom(roomId, clientCommandId),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
    },
  });
}

export function useCancelSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      cancelSharedWorkoutRoom(roomId, clientCommandId),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
    },
  });
}
