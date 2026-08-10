import type {
  ApiCursorListResponse,
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomInvitationDto,
  SharedWorkoutRoomInvitationStatus,
  SharedWorkoutRoomListItem,
  SharedWorkoutRoomStatus,
} from '@gym-companion/shared';

import { apiFetch } from '@/lib/api/client';

export type SharedWorkoutRoomListFilters = {
  status?: SharedWorkoutRoomStatus;
  cursor?: string;
  limit?: number;
};

export type SharedWorkoutInvitationListFilters = {
  status?: SharedWorkoutRoomInvitationStatus;
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

export async function inviteToSharedWorkoutRoom(
  roomId: string,
  input: { inviteeEmail: string },
): Promise<SharedWorkoutRoomInvitationDto> {
  const response = await apiFetch<{ data: SharedWorkoutRoomInvitationDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function listRoomInvitations(
  roomId: string,
  filters: SharedWorkoutInvitationListFilters = {},
): Promise<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/invitations${qs ? `?${qs}` : ''}`,
  );
}

export async function cancelRoomInvitation(
  roomId: string,
  invitationId: string,
): Promise<SharedWorkoutRoomInvitationDto> {
  const response = await apiFetch<{ data: SharedWorkoutRoomInvitationDto }>(
    `/api/v1/shared-workouts/${encodeURIComponent(roomId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
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

export async function listReceivedInvitations(
  filters: SharedWorkoutInvitationListFilters = {},
): Promise<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<ApiCursorListResponse<SharedWorkoutRoomInvitationDto>>(
    `/api/v1/shared-workout-invitations${qs ? `?${qs}` : ''}`,
  );
}

export async function acceptSharedWorkoutInvitation(
  invitationId: string,
): Promise<SharedWorkoutRoomInvitationDto> {
  const response = await apiFetch<{ data: SharedWorkoutRoomInvitationDto }>(
    `/api/v1/shared-workout-invitations/${encodeURIComponent(invitationId)}/accept`,
    { method: 'POST' },
  );
  return response.data;
}

export async function declineSharedWorkoutInvitation(
  invitationId: string,
): Promise<SharedWorkoutRoomInvitationDto> {
  const response = await apiFetch<{ data: SharedWorkoutRoomInvitationDto }>(
    `/api/v1/shared-workout-invitations/${encodeURIComponent(invitationId)}/decline`,
    { method: 'POST' },
  );
  return response.data;
}
