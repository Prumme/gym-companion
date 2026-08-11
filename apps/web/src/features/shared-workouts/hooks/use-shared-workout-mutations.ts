import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workoutQueryKeys } from '@/features/workouts/api/workout-query-keys';
import { persistServerSnapshot } from '@/features/workouts/offline/store';

import {
  attachMySharedWorkoutSession,
  cancelSharedWorkoutRoom,
  completeSharedWorkoutRoom,
  createMySharedWorkoutSession,
  createSharedWorkoutRoom,
  joinSharedWorkoutRoom,
  leaveSharedWorkoutRoom,
  rotateSharedWorkoutJoinCode,
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
    void queryClient.invalidateQueries({
      queryKey: sharedWorkoutRoomQueryKeys.myWorkoutSession(roomId),
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

export function useJoinSharedWorkoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string }) => joinSharedWorkoutRoom(input),
    onSuccess: (room) => {
      invalidateRoomQueries(queryClient, room.id);
    },
  });
}

export function useRotateSharedWorkoutJoinCodeMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => rotateSharedWorkoutJoinCode(roomId),
    onSuccess: (result) => {
      queryClient.setQueryData(
        sharedWorkoutRoomQueryKeys.detail(roomId),
        (current) =>
          current && typeof current === 'object' && 'joinCode' in current
            ? { ...current, joinCode: result.joinCode }
            : current,
      );
      invalidateRoomQueries(queryClient, roomId);
    },
  });
}

export function useLeaveSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveSharedWorkoutRoom(roomId),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
      void queryClient.removeQueries({
        queryKey: sharedWorkoutRoomQueryKeys.detail(roomId),
      });
    },
  });
}

export function useAttachMySharedWorkoutSessionMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workoutSessionId: string }) =>
      attachMySharedWorkoutSession(roomId, input),
    onSuccess: () => {
      invalidateRoomQueries(queryClient, roomId);
      void queryClient.invalidateQueries({
        queryKey: workoutQueryKeys.active(),
      });
    },
  });
}

export function useCreateMySharedWorkoutSessionMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workoutTemplateId: string;
      localDate?: string;
      timezone?: string;
    }) => createMySharedWorkoutSession(roomId, input),
    onSuccess: async (result) => {
      invalidateRoomQueries(queryClient, roomId);
      queryClient.setQueryData(
        workoutQueryKeys.active(),
        result.workoutSession,
      );
      queryClient.setQueryData(
        workoutQueryKeys.detail(result.workoutSession.id),
        result.workoutSession,
      );
      const userId = queryClient.getQueryData<{ data: { id: string } }>([
        'me',
      ])?.data?.id;
      if (userId) {
        await persistServerSnapshot(userId, result.workoutSession);
      }
    },
  });
}
