/**
 * Shared 5.4 — rattachement / création de WorkoutSession individuelle via une room.
 */

import { z } from 'zod';

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format YYYY-MM-DD.');

/** Shared 5.4 — rattacher une séance ACTIVE/PAUSED existante. */
export const attachMySharedWorkoutSessionBodySchema = z
  .object({
    workoutSessionId: z.string().uuid(),
  })
  .strict();

export type AttachMySharedWorkoutSessionInput = z.infer<
  typeof attachMySharedWorkoutSessionBodySchema
>;

/**
 * Shared 5.4 — créer une séance depuis un template et l’associer.
 * Aligné sur createWorkoutSessionSchema ; localDate/timezone optionnels
 * (fallback profil serveur si absents).
 */
export const createMySharedWorkoutSessionBodySchema = z
  .object({
    workoutTemplateId: z.string().uuid(),
    localDate: localDateSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type CreateMySharedWorkoutSessionInput = z.infer<
  typeof createMySharedWorkoutSessionBodySchema
>;
