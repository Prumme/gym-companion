/**
 * Shared 5.1 — Fondations des salles de séance partagée.
 * REST uniquement. Pas d’invitations, pas de Socket.IO, pas de WorkoutSession.
 */

import { z } from 'zod';

export const SHARED_WORKOUT_ROOM_NAME_MAX = 80;
export const SHARED_WORKOUT_ROOM_DEFAULT_NAME = 'Séance partagée';
export const SHARED_WORKOUT_ROOM_LIST_DEFAULT_LIMIT = 20;
export const SHARED_WORKOUT_ROOM_LIST_MAX_LIMIT = 50;

export const sharedWorkoutRoomStatusSchema = z.enum([
  'LOBBY',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export type SharedWorkoutRoomStatusValue = z.infer<
  typeof sharedWorkoutRoomStatusSchema
>;

export const sharedWorkoutRoomMemberRoleSchema = z.enum(['OWNER', 'MEMBER']);

export const sharedWorkoutRoomLifecycleActionSchema = z.enum([
  'START',
  'COMPLETE',
  'CANCEL',
]);

export type SharedWorkoutRoomLifecycleAction = z.infer<
  typeof sharedWorkoutRoomLifecycleActionSchema
>;

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}

export const createSharedWorkoutRoomBodySchema = z
  .object({
    name: z
      .preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .min(1)
          .max(SHARED_WORKOUT_ROOM_NAME_MAX)
          .optional(),
      )
      .optional(),
  })
  .strict();

export type CreateSharedWorkoutRoomInput = z.infer<
  typeof createSharedWorkoutRoomBodySchema
>;

export const updateSharedWorkoutRoomBodySchema = z
  .object({
    name: z.string().trim().min(1).max(SHARED_WORKOUT_ROOM_NAME_MAX),
  })
  .strict();

export type UpdateSharedWorkoutRoomInput = z.infer<
  typeof updateSharedWorkoutRoomBodySchema
>;

export const sharedWorkoutRoomLifecycleCommandBodySchema = z
  .object({
    clientCommandId: z.string().uuid(),
  })
  .strict();

export type SharedWorkoutRoomLifecycleCommandInput = z.infer<
  typeof sharedWorkoutRoomLifecycleCommandBodySchema
>;

const sharedWorkoutRoomListLimitSchema = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .int()
    .min(1)
    .max(SHARED_WORKOUT_ROOM_LIST_MAX_LIMIT)
    .default(SHARED_WORKOUT_ROOM_LIST_DEFAULT_LIMIT),
);

export const sharedWorkoutRoomListQuerySchema = z
  .object({
    status: z.preprocess(
      emptyToUndefined,
      sharedWorkoutRoomStatusSchema.optional(),
    ),
    cursor: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    limit: sharedWorkoutRoomListLimitSchema,
  })
  .strict();

export type SharedWorkoutRoomListQuery = z.infer<
  typeof sharedWorkoutRoomListQuerySchema
>;

export type SharedWorkoutRoomCursorPayload = {
  version: 1;
  updatedAt: string;
  id: string;
};

export function encodeSharedWorkoutRoomCursor(
  payload: SharedWorkoutRoomCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeSharedWorkoutRoomCursor(
  cursor: string,
): SharedWorkoutRoomCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('SHARED_WORKOUT_ROOM_INVALID_CURSOR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { updatedAt?: unknown }).updatedAt !== 'string' ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    (parsed as { updatedAt: string }).updatedAt.length === 0 ||
    (parsed as { id: string }).id.length === 0
  ) {
    throw new Error('SHARED_WORKOUT_ROOM_INVALID_CURSOR');
  }

  return {
    version: 1,
    updatedAt: (parsed as { updatedAt: string }).updatedAt,
    id: (parsed as { id: string }).id,
  };
}

/** Cursor sur tri `updatedAt desc, id desc`. */
export function buildSharedWorkoutRoomCursorFilter(
  cursor: SharedWorkoutRoomCursorPayload,
): {
  OR: Array<
    | { updatedAt: { lt: Date } }
    | { AND: [{ updatedAt: Date }, { id: { lt: string } }] }
  >;
} {
  const updatedAt = new Date(cursor.updatedAt);
  return {
    OR: [
      { updatedAt: { lt: updatedAt } },
      {
        AND: [{ updatedAt }, { id: { lt: cursor.id } }],
      },
    ],
  };
}

export function resolveSharedWorkoutRoomName(
  name: string | undefined,
): string {
  const trimmed = name?.trim() ?? '';
  if (trimmed.length > 0) return trimmed.slice(0, SHARED_WORKOUT_ROOM_NAME_MAX);
  return SHARED_WORKOUT_ROOM_DEFAULT_NAME;
}

export type SharedRoomLifecycleTransitionResult =
  | {
      ok: true;
      kind: 'apply';
      nextStatus: SharedWorkoutRoomStatusValue;
      setStartedAt: boolean;
      setCompletedAt: boolean;
      setCancelledAt: boolean;
    }
  | { ok: true; kind: 'noop' }
  | { ok: false; code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS' };

/**
 * Transitions autorisées Shared 5.1 :
 * LOBBY → ACTIVE → COMPLETED
 * LOBBY → CANCELLED
 * ACTIVE → CANCELLED
 */
export function resolveSharedWorkoutRoomLifecycleTransition(
  current: SharedWorkoutRoomStatusValue,
  action: SharedWorkoutRoomLifecycleAction,
): SharedRoomLifecycleTransitionResult {
  if (action === 'START') {
    if (current === 'LOBBY') {
      return {
        ok: true,
        kind: 'apply',
        nextStatus: 'ACTIVE',
        setStartedAt: true,
        setCompletedAt: false,
        setCancelledAt: false,
      };
    }
    if (current === 'ACTIVE') {
      return { ok: true, kind: 'noop' };
    }
    return { ok: false, code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS' };
  }

  if (action === 'COMPLETE') {
    if (current === 'ACTIVE') {
      return {
        ok: true,
        kind: 'apply',
        nextStatus: 'COMPLETED',
        setStartedAt: false,
        setCompletedAt: true,
        setCancelledAt: false,
      };
    }
    if (current === 'COMPLETED') {
      return { ok: true, kind: 'noop' };
    }
    return { ok: false, code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS' };
  }

  // CANCEL
  if (current === 'LOBBY' || current === 'ACTIVE') {
    return {
      ok: true,
      kind: 'apply',
      nextStatus: 'CANCELLED',
      setStartedAt: false,
      setCompletedAt: false,
      setCancelledAt: true,
    };
  }
  if (current === 'CANCELLED') {
    return { ok: true, kind: 'noop' };
  }
  return { ok: false, code: 'SHARED_WORKOUT_ROOM_INVALID_STATUS' };
}

export function canRenameSharedWorkoutRoom(
  status: SharedWorkoutRoomStatusValue,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}

/** Hash synchrone stable (navigateur + Node) — aligné Coach explanation. */
function stableDigestHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x811c9dc5;
  let h4 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x811c9dc5);
    h3 = Math.imul(h3 ^ ((c << 1) + i), 0x01000193);
    h4 = Math.imul(h4 ^ ((c << 2) ^ i), 0x811c9dc5);
  }
  return [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

export function buildSharedWorkoutRoomLifecycleFingerprint(input: {
  action: SharedWorkoutRoomLifecycleAction;
  roomId: string;
}): string {
  return stableDigestHex(`${input.action}:${input.roomId}`);
}
