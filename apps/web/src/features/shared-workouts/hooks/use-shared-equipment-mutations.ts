import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  cancelMySharedEquipmentWaiting,
  releaseMySharedEquipment,
  requestMySharedEquipment,
} from '../api/shared-workouts-api';
import { sharedWorkoutRoomQueryKeys } from '../api/shared-workout-query-keys';

function invalidateEquipment(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: sharedWorkoutRoomQueryKeys.equipmentCoordination(roomId),
  });
  void queryClient.invalidateQueries({
    queryKey: sharedWorkoutRoomQueryKeys.myEquipment(roomId),
  });
}

export function useRequestSharedEquipmentMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      requestMySharedEquipment(roomId, clientCommandId),
    onSuccess: () => invalidateEquipment(queryClient, roomId),
  });
}

export function useReleaseSharedEquipmentMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      releaseMySharedEquipment(roomId, clientCommandId),
    onSuccess: () => invalidateEquipment(queryClient, roomId),
  });
}

export function useCancelSharedEquipmentWaitingMutation(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientCommandId: string) =>
      cancelMySharedEquipmentWaiting(roomId, clientCommandId),
    onSuccess: () => invalidateEquipment(queryClient, roomId),
  });
}
