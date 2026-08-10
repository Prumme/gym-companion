/**
 * Shared 5.2 — Invitations / adhésion / leave.
 * Invitation par email exact (compte existant). Pas de code public, pas de Socket.IO.
 */

import { z } from 'zod';

import {
  SHARED_WORKOUT_ROOM_LIST_DEFAULT_LIMIT,
  SHARED_WORKOUT_ROOM_LIST_MAX_LIMIT,
  sharedWorkoutRoomStatusSchema,
} from './shared-workout-rooms';

export const sharedWorkoutRoomInvitationStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
]);

export type SharedWorkoutRoomInvitationStatusValue = z.infer<
  typeof sharedWorkoutRoomInvitationStatusSchema
>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

/** Même normalisation que register/login (trim + lower avant validation email). */
export const createSharedWorkoutRoomInvitationBodySchema = z
  .object({
    inviteeEmail: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z.string().email(),
    ),
  })
  .strict();

export type CreateSharedWorkoutRoomInvitationInput = z.infer<
  typeof createSharedWorkoutRoomInvitationBodySchema
>;

const invitationListLimitSchema = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int()
    .min(1)
    .max(SHARED_WORKOUT_ROOM_LIST_MAX_LIMIT)
    .default(SHARED_WORKOUT_ROOM_LIST_DEFAULT_LIMIT),
);

export const sharedWorkoutRoomInvitationListQuerySchema = z
  .object({
    status: z.preprocess(
      emptyToUndefined,
      sharedWorkoutRoomInvitationStatusSchema.optional(),
    ),
    cursor: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    limit: invitationListLimitSchema,
  })
  .strict();

export type SharedWorkoutRoomInvitationListQuery = z.infer<
  typeof sharedWorkoutRoomInvitationListQuerySchema
>;

export type SharedWorkoutRoomInvitationCursorPayload = {
  version: 1;
  createdAt: string;
  id: string;
};

export function encodeSharedWorkoutRoomInvitationCursor(
  payload: SharedWorkoutRoomInvitationCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeSharedWorkoutRoomInvitationCursor(
  cursor: string,
): SharedWorkoutRoomInvitationCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('SHARED_WORKOUT_INVITATION_INVALID_CURSOR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { createdAt?: unknown }).createdAt !== 'string' ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    (parsed as { createdAt: string }).createdAt.length === 0 ||
    (parsed as { id: string }).id.length === 0
  ) {
    throw new Error('SHARED_WORKOUT_INVITATION_INVALID_CURSOR');
  }

  return {
    version: 1,
    createdAt: (parsed as { createdAt: string }).createdAt,
    id: (parsed as { id: string }).id,
  };
}

/** Cursor sur tri `createdAt desc, id desc`. */
export function buildSharedWorkoutRoomInvitationCursorFilter(
  cursor: SharedWorkoutRoomInvitationCursorPayload,
): {
  OR: Array<
    | { createdAt: { lt: Date } }
    | { AND: [{ createdAt: Date }, { id: { lt: string } }] }
  >;
} {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      {
        AND: [{ createdAt }, { id: { lt: cursor.id } }],
      },
    ],
  };
}

export function canInviteToSharedWorkoutRoom(
  status: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}

export function canAcceptSharedWorkoutRoomInvitation(
  roomStatus: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return roomStatus === 'LOBBY' || roomStatus === 'ACTIVE';
}

export function canLeaveSharedWorkoutRoom(
  status: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}
