/**
 * Partage temporaire de programmes / modèles de séance / exercices personnels.
 * Snapshot versionné, immutable, import = copie (pas de sync).
 */

import { z } from 'zod';

import { coachProposalSetSchema, type CoachProposalSet } from './ai-coach-structured';
import {
  cardioTypeSchema,
  exerciseCategorySchema,
  exerciseMeasurementTypeSchema,
} from './exercise-enums';

export const TRAINING_SHARE_LIFETIME_MS = 60 * 60 * 1000;
export const TRAINING_SHARE_SNAPSHOT_VERSION = 1 as const;

export const trainingShareKindSchema = z.enum(['PROGRAM', 'WORKOUT_TEMPLATE', 'EXERCISE']);
export type TrainingShareKind = z.infer<typeof trainingShareKindSchema>;

/** Set portable — mêmes cibles que le Program Builder / Coach. */
export const sharedTemplateSetSchema = coachProposalSetSchema;
export type SharedTemplateSet = CoachProposalSet;

export const SHARED_PERSONAL_EXERCISES_MAX = 40;

/**
 * Définition portable d’un exercice personnel (USER).
 * À l’import, l’exercice est recréé chez le destinataire (ou réutilisé s’il
 * possède déjà un exercice équivalent). La validation métier complète
 * (`createExerciseSchema` + référentiels actifs) est rejouée côté API.
 */
export const sharedExerciseDefinitionSchema = z
  .object({
    key: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(120),
    measurementType: exerciseMeasurementTypeSchema,
    category: exerciseCategorySchema,
    cardioType: cardioTypeSchema.nullable(),
    primaryMuscleGroupId: z.string().uuid(),
    secondaryMuscleGroupIds: z.array(z.string().uuid()).max(20),
    defaultEquipmentTypeId: z.string().uuid().nullable(),
    compatibleEquipmentTypes: z
      .array(
        z
          .object({
            equipmentTypeId: z.string().uuid(),
            isPreferred: z.boolean(),
            notes: z.string().max(500).nullable(),
          })
          .strict(),
      )
      .max(20),
    defaultRestSeconds: z.number().int().min(0).max(3600).nullable(),
    instructions: z.string().max(4000).nullable(),
  })
  .strict();

export type SharedExerciseDefinition = z.infer<typeof sharedExerciseDefinitionSchema>;

/**
 * Exercice d’une séance partagée : soit un exercice SYSTEM (`exerciseId`),
 * soit un exercice personnel décrit dans `personalExercises` (`personalExerciseKey`).
 * Les snapshots émis avant l’ajout de `personalExerciseKey` restent valides.
 */
export const sharedTemplateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid().nullable(),
    personalExerciseKey: z.string().min(1).max(64).nullable().optional(),
    equipmentTypeId: z.string().uuid().nullable(),
    notes: z.string().max(2000).nullable(),
    restSecondsOverride: z.number().int().min(0).max(1800).nullable(),
    sets: z.array(sharedTemplateSetSchema).max(30),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasSystem = data.exerciseId != null;
    const hasPersonal = data.personalExerciseKey != null;
    if (hasSystem === hasPersonal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exerciseId'],
        message:
          'Un exercice partagé référence soit un exercice du catalogue, soit un exercice personnel.',
      });
    }
  });

export type SharedTemplateExercise = z.infer<typeof sharedTemplateExerciseSchema>;

export const sharedWorkoutTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    estimatedDurationMinutes: z.number().int().min(1).max(600).nullable(),
    exercises: z.array(sharedTemplateExerciseSchema).max(40),
  })
  .strict();

export type SharedWorkoutTemplateBody = z.infer<typeof sharedWorkoutTemplateBodySchema>;

const personalExercisesSchema = z
  .array(sharedExerciseDefinitionSchema)
  .max(SHARED_PERSONAL_EXERCISES_MAX)
  .optional();

export const sharedWorkoutTemplateSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    kind: z.literal('WORKOUT_TEMPLATE'),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    estimatedDurationMinutes: z.number().int().min(1).max(600).nullable(),
    exercises: z.array(sharedTemplateExerciseSchema).max(40),
    personalExercises: personalExercisesSchema,
  })
  .strict();

export type SharedWorkoutTemplateSnapshotV1 = z.infer<typeof sharedWorkoutTemplateSnapshotV1Schema>;

export const sharedProgramSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    kind: z.literal('PROGRAM'),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    goal: z.enum(['ENDURANCE', 'HYPERTROPHY', 'STRENGTH', 'GENERAL_FITNESS']),
    workouts: z.array(sharedWorkoutTemplateBodySchema).min(1).max(30),
    personalExercises: personalExercisesSchema,
  })
  .strict();

export type SharedProgramSnapshotV1 = z.infer<typeof sharedProgramSnapshotV1Schema>;

export const sharedExerciseSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    kind: z.literal('EXERCISE'),
    exercise: sharedExerciseDefinitionSchema,
  })
  .strict();

export type SharedExerciseSnapshotV1 = z.infer<typeof sharedExerciseSnapshotV1Schema>;

function refinePersonalExerciseReferences(
  snapshot: SharedProgramSnapshotV1 | SharedWorkoutTemplateSnapshotV1 | SharedExerciseSnapshotV1,
  ctx: z.RefinementCtx,
) {
  if (snapshot.kind === 'EXERCISE') return;
  const definitions = snapshot.personalExercises ?? [];
  const keys = new Set<string>();
  for (const definition of definitions) {
    if (keys.has(definition.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['personalExercises'],
        message: 'Clé d’exercice personnel en double.',
      });
    }
    keys.add(definition.key);
  }
  const workouts = snapshot.kind === 'PROGRAM' ? snapshot.workouts : [snapshot];
  const used = new Set<string>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const key = exercise.personalExerciseKey;
      if (key == null) continue;
      used.add(key);
      if (!keys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['personalExercises'],
          message: 'Exercice personnel référencé mais non décrit.',
        });
      }
    }
  }
  if (used.size !== keys.size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['personalExercises'],
      message: 'Exercice personnel décrit mais jamais utilisé.',
    });
  }
}

export const trainingShareSnapshotSchema = z
  .discriminatedUnion('kind', [
    sharedProgramSnapshotV1Schema,
    sharedWorkoutTemplateSnapshotV1Schema,
    sharedExerciseSnapshotV1Schema,
  ])
  .superRefine(refinePersonalExerciseReferences);

export type TrainingShareSnapshot = z.infer<typeof trainingShareSnapshotSchema>;

export const createTrainingShareResponseSchema = z
  .object({
    token: z.string().min(1),
    expiresAt: z.string().datetime(),
    kind: trainingShareKindSchema,
  })
  .strict();

export type CreateTrainingShareResponse = z.infer<typeof createTrainingShareResponseSchema>;

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
    exerciseId: z.string().uuid().nullable(),
    name: z.string(),
    measurementType: z.string(),
    isPersonal: z.boolean(),
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

export const trainingShareExerciseDefinitionPreviewSchema = z
  .object({
    kind: z.literal('EXERCISE'),
    name: z.string(),
    measurementType: z.string(),
    category: z.string(),
    cardioType: z.string().nullable(),
    primaryMuscleGroupName: z.string().nullable(),
    secondaryMuscleGroupNames: z.array(z.string()),
    defaultEquipmentName: z.string().nullable(),
    instructions: z.string().nullable(),
  })
  .strict();

export const trainingSharePreviewSchema = z
  .object({
    kind: trainingShareKindSchema,
    expiresAt: z.string().datetime(),
    preview: z.discriminatedUnion('kind', [
      trainingShareProgramPreviewSchema,
      trainingShareWorkoutPreviewSchema,
      trainingShareExerciseDefinitionPreviewSchema,
    ]),
  })
  .strict();

export type TrainingSharePreview = z.infer<typeof trainingSharePreviewSchema>;

export const importTrainingShareDestinationSchema = z.discriminatedUnion('type', [
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
]);

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
    programId: z.string().uuid().nullable(),
    workoutTemplateId: z.string().uuid().nullable(),
    exerciseId: z.string().uuid().nullable(),
  })
  .strict();

export type ImportTrainingShareResult = z.infer<typeof importTrainingShareResultSchema>;

/** Préfixe intelligent pour un nouveau programme créé depuis une séance. */
export function suggestProgramNameFromWorkoutTemplate(workoutName: string): string {
  const trimmed = workoutName.trim();
  if (!trimmed) return 'Nouveau programme';
  if (/^programme\b/i.test(trimmed)) return trimmed.slice(0, 120);
  return `Programme ${trimmed}`.slice(0, 120);
}

export function isTrainingShareExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}
