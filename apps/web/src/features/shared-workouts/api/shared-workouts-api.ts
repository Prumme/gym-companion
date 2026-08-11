import type {
  ApiCursorListResponse,
  MySharedWorkoutEquipmentState,
  MySharedWorkoutSessionDto,
  SharedWorkoutEquipmentCoordinationDto,
  SharedWorkoutJoinCodeDto,
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomListItem,
  SharedWorkoutRoomStatus,
  SharedWorkoutSessionContextDto,
  WorkoutSessionDetail,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export type SharedWorkoutRoomListFilters = {
  status?: SharedWorkoutRoomStatus;
  cursor?: string;
  limit?: number;
};

export async function createSharedWorkoutRoom(input: {
  name?: string;
}): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    '/api/v1/shared-workouts',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function listSharedWorkoutRooms(
  filters: SharedWorkoutRoomListFilters = {},
): Promise<ApiCursorListResponse<SharedWorkoutRoomListItem>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<ApiCursorListResponse<SharedWorkoutRoomListItem>>(
    `/api/v1/shared-workouts${qs ? `?${qs}` : ''}`,
  );
}

export async function getSharedWorkoutRoom(
  roomId: string,
): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}`,
  );
  return response.data;
}

export async function updateSharedWorkoutRoom(
  roomId: string,
  input: { name: string },
): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function startSharedWorkoutRoom(
  roomId: string,
  clientCommandId: string,
): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

export async function completeSharedWorkoutRoom(
  roomId: string,
  clientCommandId: string,
): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

export async function cancelSharedWorkoutRoom(
  roomId: string,
  clientCommandId: string,
): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

export async function joinSharedWorkoutRoom(input: {
  code: string;
}): Promise<SharedWorkoutRoomDetail> {
  const response = await apiFetch<{ data: SharedWorkoutRoomDetail }>(
    '/api/v1/shared-workouts/join',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function rotateSharedWorkoutJoinCode(
  roomId: string,
): Promise<SharedWorkoutJoinCodeDto> {
  const response = await apiFetch<{ data: SharedWorkoutJoinCodeDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/join-code/rotate`,
    { method: 'POST' },
  );
  return response.data;
}

export async function leaveSharedWorkoutRoom(
  roomId: string,
): Promise<{ left: true }> {
  const response = await apiFetch<{ data: { left: true } }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/leave`,
    { method: 'POST' },
  );
  return response.data;
}

export async function getMySharedWorkoutSession(
  roomId: string,
): Promise<MySharedWorkoutSessionDto> {
  const response = await apiFetch<{ data: MySharedWorkoutSessionDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-workout-session`,
  );
  return response.data;
}

export async function attachMySharedWorkoutSession(
  roomId: string,
  input: { workoutSessionId: string },
): Promise<MySharedWorkoutSessionDto> {
  const response = await apiFetch<{ data: MySharedWorkoutSessionDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-workout-session/attach`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function createMySharedWorkoutSession(
  roomId: string,
  input: {
    workoutTemplateId: string;
    localDate?: string;
    timezone?: string;
  },
): Promise<{
  mySession: MySharedWorkoutSessionDto;
  workoutSession: WorkoutSessionDetail;
}> {
  const response = await apiFetch<{
    data: {
      mySession: MySharedWorkoutSessionDto;
      workoutSession: WorkoutSessionDetail;
    };
  }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-workout-session/create`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function setMySharedCurrentExercise(
  roomId: string,
  input: { workoutSessionExerciseId: string | null },
): Promise<MySharedWorkoutSessionDto> {
  const response = await apiFetch<{ data: MySharedWorkoutSessionDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-workout-session/current-exercise`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function getSharedWorkoutSessionContext(
  workoutSessionId: string,
): Promise<SharedWorkoutSessionContextDto> {
  const response = await apiFetch<{ data: SharedWorkoutSessionContextDto }>(
    `/api/v1/shared-workouts/by-workout-session/${encodeURIComponent(workoutSessionId)}/context`,
  );
  return response.data;
}

export async function getSharedWorkoutEquipmentCoordination(
  roomId: string,
): Promise<SharedWorkoutEquipmentCoordinationDto> {
  const response = await apiFetch<{ data: SharedWorkoutEquipmentCoordinationDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/equipment-coordination`,
  );
  return response.data;
}

export async function getMySharedEquipment(
  roomId: string,
): Promise<MySharedWorkoutEquipmentState> {
  const response = await apiFetch<{ data: MySharedWorkoutEquipmentState }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-equipment`,
  );
  return response.data;
}

export async function requestMySharedEquipment(
  roomId: string,
  clientCommandId: string,
): Promise<MySharedWorkoutEquipmentState> {
  const response = await apiFetch<{ data: MySharedWorkoutEquipmentState }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-equipment/request`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

export async function releaseMySharedEquipment(
  roomId: string,
  clientCommandId: string,
): Promise<MySharedWorkoutEquipmentState> {
  const response = await apiFetch<{ data: MySharedWorkoutEquipmentState }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-equipment/release`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

export async function cancelMySharedEquipmentWaiting(
  roomId: string,
  clientCommandId: string,
): Promise<MySharedWorkoutEquipmentState> {
  const response = await apiFetch<{ data: MySharedWorkoutEquipmentState }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/my-equipment/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ clientCommandId }),
    },
  );
  return response.data;
}

