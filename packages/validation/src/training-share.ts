/**
 * Partage temporaire de programmes / modèles de séance (templates).
 * Snapshot versionné, immutable, import = copie (pas de sync).
 */

import { z } from 'zod';

import {
  coachProposalSetSchema,
  type CoachProposalSet,
} from './ai-coach-structured';

export const TRAINING_SHARE_LIFETIME_MS = 60 * 60 * 1000;
export const TRAINING_SHARE_SNAPSHOT_VERSION = 1 as const;

export const trainingShareKindSchema = z.enum([
  'PROGRAM',
  'WORKOUT_TEMPLATE',
]);
export type TrainingShareKind = z.infer<typeof trainingShareKindSchema>;

/** Set portable — mêmes cibles que le Program Builder / Coach. */
export const sharedTemplateSetSchema = coachProposalSetSchema;
export type SharedTemplateSet = CoachProposalSet;

export const sharedTemplateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid(),
    equipmentTypeId: z.string().uuid().nullable(),
    notes: z.string().max(2000).nullable(),
    restSecondsOverride: z.number().int().min(0).max(1800).nullable(),
    sets: z.array(sharedTemplateSetSchema).max(30),
  })
  .strict();

export type SharedTemplateExercise = z.infer<
  typeof sharedTemplateExerciseSchema
>;

export const sharedWorkoutTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    estimatedDurationMinutes: z.number().int().min(1).max(600).nullable(),
    exercises: z.array(sharedTemplateExerciseSchema).max(40),
  })
  .strict();

export type SharedWorkoutTemplateBody = z.infer<
  typeof sharedWorkoutTemplateBodySchema
>;

export const sharedWorkoutTemplateSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    kind: z.literal('WORKOUT_TEMPLATE'),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    estimatedDurationMinutes: z.number().int().min(1).max(600).nullable(),
    exercises: z.array(sharedTemplateExerciseSchema).max(40),
  })
  .strict();

export type SharedWorkoutTemplateSnapshotV1 = z.infer<
  typeof sharedWorkoutTemplateSnapshotV1Schema
>;

export const sharedProgramSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    kind: z.literal('PROGRAM'),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    goal: z.enum(['ENDURANCE', 'HYPERTROPHY', 'STRENGTH', 'GENERAL_FITNESS']),
    workouts: z.array(sharedWorkoutTemplateBodySchema).min(1).max(30),
  })
  .strict();

export type SharedProgramSnapshotV1 = z.infer<
  typeof sharedProgramSnapshotV1Schema
>;

export const trainingShareSnapshotSchema = z.discriminatedUnion('kind', [
  sharedProgramSnapshotV1Schema,
  sharedWorkoutTemplateSnapshotV1Schema,
]);

export type TrainingShareSnapshot = z.infer<typeof trainingShareSnapshotSchema>;

export const createTrainingShareResponseSchema = z
  .object({
    token: z.string().min(1),
    expiresAt: z.string().datetime(),
    kind: trainingShareKindSchema,
  })
  .strict();

export type CreateTrainingShareResponse = z.infer<
  typeof createTrainingShareResponseSchema
>;

export const sharedSetPreviewSchema = z
  .object({
    setType: z.string(),
    targetRepMin: z.number().nullable(),
    targetRepMax: z.number().nullable(),
    targetDurationSeconds: z.number().nullable(),
    targetDistanceMeters: z.number().nullable(),
    targetWeightKg: z.number().nullable(),
    restSeconds: z.number().nullable(),
  })
  .strict();

export const sharedExercisePreviewSchema = z
  .object({
    exerciseId: z.string().uuid(),
    name: z.string(),
    measurementType: z.string(),
    sets: z.array(sharedSetPreviewSchema),
  })
  .strict();

export const sharedWorkoutPreviewSchema = z
  .object({
    name: z.string(),
    estimatedDurationMinutes: z.number().nullable(),
    exerciseCount: z.number().int().nonnegative(),
    exercises: z.array(sharedExercisePreviewSchema),
  })
  .strict();

export const trainingShareProgramPreviewSchema = z
  .object({
    kind: z.literal('PROGRAM'),
    name: z.string(),
    description: z.string().nullable(),
    goal: z.string(),
    workoutCount: z.number().int().positive(),
    workouts: z.array(sharedWorkoutPreviewSchema),
  })
  .strict();

export const trainingShareWorkoutPreviewSchema = z
  .object({
    kind: z.literal('WORKOUT_TEMPLATE'),
    name: z.string(),
    description: z.string().nullable(),
    estimatedDurationMinutes: z.number().nullable(),
    exerciseCount: z.number().int().nonnegative(),
    exercises: z.array(sharedExercisePreviewSchema),
  })
  .strict();

export const trainingSharePreviewSchema = z
  .object({
    kind: trainingShareKindSchema,
    expiresAt: z.string().datetime(),
    preview: z.discriminatedUnion('kind', [
      trainingShareProgramPreviewSchema,
      trainingShareWorkoutPreviewSchema,
    ]),
  })
  .strict();

export type TrainingSharePreview = z.infer<typeof trainingSharePreviewSchema>;

export const importTrainingShareDestinationSchema = z.discriminatedUnion(
  'type',
  [
    z
      .object({
        type: z.literal('EXISTING_PROGRAM'),
        programId: z.string().uuid(),
      })
      .strict(),
    z
      .object({
        type: z.literal('NEW_PROGRAM'),
        programName: z.string().trim().min(1).max(120),
      })
      .strict(),
  ],
);

export const importTrainingShareSchema = z
  .object({
    destination: importTrainingShareDestinationSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // destination est validé côté service selon kind ; ici on laisse optional.
    void data;
    void ctx;
  });

export type ImportTrainingShareInput = z.infer<typeof importTrainingShareSchema>;

export const importTrainingShareResultSchema = z
  .object({
    kind: trainingShareKindSchema,
    programId: z.string().uuid(),
    workoutTemplateId: z.string().uuid().nullable(),
  })
  .strict();

export type ImportTrainingShareResult = z.infer<
  typeof importTrainingShareResultSchema
>;

/** Préfixe intelligent pour un nouveau programme créé depuis une séance. */
export function suggestProgramNameFromWorkoutTemplate(
  workoutName: string,
): string {
  const trimmed = workoutName.trim();
  if (!trimmed) return 'Nouveau programme';
  if (/^programme\b/i.test(trimmed)) return trimmed.slice(0, 120);
  return `Programme ${trimmed}`.slice(0, 120);
}

export function isTrainingShareExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= expiresAt.getTime();
}
