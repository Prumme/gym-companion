import type {
  ApiCursorListResponse,
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomListItem,
  SharedWorkoutRoomStatus,
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
