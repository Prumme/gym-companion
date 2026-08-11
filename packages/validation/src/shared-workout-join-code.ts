/**
 * Shared Workouts — code d’accès de salle (XXX-XXX).
 * Alphabet sans caractères visuellement ambigus (I/O/0/1 exclus).
 *
 * La génération cryptographique vit côté API (`node:crypto`) —
 * ce module reste utilisable par le web (Vite).
 */

import { z } from 'zod';

import { sharedWorkoutRoomStatusSchema } from './shared-workout-rooms';

/** Alphabet sûr pour affichage / saisie (pas I, O, 0, 1). */
export const SHARED_WORKOUT_JOIN_CODE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;

export const SHARED_WORKOUT_JOIN_CODE_LENGTH = 6 as const;

export const SHARED_WORKOUT_JOIN_CODE_GENERATE_MAX_ATTEMPTS = 10 as const;

const ALPHABET_SET = new Set(SHARED_WORKOUT_JOIN_CODE_ALPHABET.split(''));

/**
 * Normalise une saisie utilisateur vers 6 caractères uppercase sans tiret.
 * Lève une ZodError si invalide.
 */
export function normalizeSharedWorkoutJoinCode(input: unknown): string {
  if (typeof input !== 'string') {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['code'],
        message: 'Code invalide ou expiré.',
      },
    ]);
  }

  const cleaned = input.trim().toUpperCase().replace(/[\s-]+/g, '');

  if (cleaned.length !== SHARED_WORKOUT_JOIN_CODE_LENGTH) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['code'],
        message: 'Code invalide ou expiré.',
      },
    ]);
  }

  for (const char of cleaned) {
    if (!ALPHABET_SET.has(char)) {
      throw new z.ZodError([
        {
          code: 'custom',
          path: ['code'],
          message: 'Code invalide ou expiré.',
        },
      ]);
    }
  }

  return cleaned;
}

/** Affichage XXX-XXX à partir d’un code normalisé. */
export function formatSharedWorkoutJoinCode(normalized: string): string {
  if (normalized.length !== SHARED_WORKOUT_JOIN_CODE_LENGTH) {
    throw new Error('SHARED_WORKOUT_JOIN_CODE_INVALID_LENGTH');
  }
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

export const joinSharedWorkoutBodySchema = z
  .object({
    code: z.string().min(1),
  })
  .strict()
  .transform((value) => ({
    code: normalizeSharedWorkoutJoinCode(value.code),
  }));

export type JoinSharedWorkoutInput = z.infer<typeof joinSharedWorkoutBodySchema>;

export function canJoinSharedWorkoutRoomByCode(
  status: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}

export function canRotateSharedWorkoutJoinCode(
  status: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}

/** Leave autorisé en LOBBY/ACTIVE. */
export function canLeaveSharedWorkoutRoom(
  status: z.infer<typeof sharedWorkoutRoomStatusSchema>,
): boolean {
  return status === 'LOBBY' || status === 'ACTIVE';
}
