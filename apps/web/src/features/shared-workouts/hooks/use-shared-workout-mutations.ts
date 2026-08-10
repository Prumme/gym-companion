import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  acceptSharedWorkoutInvitation,
  cancelRoomInvitation,
  cancelSharedWorkoutRoom,
  completeSharedWorkoutRoom,
  createSharedWorkoutRoom,
  declineSharedWorkoutInvitation,
  inviteToSharedWorkoutRoom,
  leaveSharedWorkoutRoom,
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
      queryKey: sharedWorkoutRoomQueryKeys.roomInvitations(roomId),
    });
  }
}

function invalidateReceivedInvitations(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: [...sharedWorkoutRoomQueryKeys.all, 'received-invitations'],
  });
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
      invalidateReceivedInvitations(queryClient);
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
      invalidateReceivedInvitations(queryClient);
    },
  });
}

export function useInviteSharedWorkoutRoomMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { inviteeEmail: string }) =>
      inviteToSharedWorkoutRoom(roomId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.roomInvitations(roomId),
      });
    },
  });
}

export function useCancelRoomInvitationMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      cancelRoomInvitation(roomId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.roomInvitations(roomId),
      });
      invalidateReceivedInvitations(queryClient);
    },
  });
}

export function useAcceptInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptSharedWorkoutInvitation,
    onSuccess: (invitation) => {
      invalidateReceivedInvitations(queryClient);
      invalidateRoomQueries(queryClient, invitation.room.id);
    },
  });
}

export function useDeclineInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: declineSharedWorkoutInvitation,
    onSuccess: (invitation) => {
      invalidateReceivedInvitations(queryClient);
      void queryClient.invalidateQueries({
        queryKey: sharedWorkoutRoomQueryKeys.roomInvitations(invitation.room.id),
      });
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
