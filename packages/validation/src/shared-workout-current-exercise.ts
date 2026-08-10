/**
 * Shared 5.5 — sélection d’exercice courant (coordination).
 */

import { z } from 'zod';

export const setMySharedCurrentExerciseBodySchema = z
  .object({
    workoutSessionExerciseId: z.string().uuid().nullable(),
  })
  .strict();

export type SetMySharedCurrentExerciseInput = z.infer<
  typeof setMySharedCurrentExerciseBodySchema
>;
