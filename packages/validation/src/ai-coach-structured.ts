/**
 * Coach IA — réponses structurées (discussion | proposal).
 * Structured Outputs (json_schema strict) + validation Zod métier.
 */

import { z } from 'zod';

export const AI_COACH_STRUCTURED_SCHEMA_VERSION =
  'AI_COACH_STRUCTURED_V1' as const;
export const AI_COACH_STRUCTURED_PROMPT_VERSION =
  'AI_COACH_STRUCTURED_PROMPT_V1' as const;

export const AI_COACH_PROPOSAL_TEXT_MAX = 280;
export const AI_COACH_DISCUSSION_TEXT_MAX = 1800;

export const AI_COACH_PROPOSAL_MAX_EXERCISES_PER_WORKOUT = 12;
export const AI_COACH_PROPOSAL_MAX_SETS_PER_EXERCISE = 10;
export const AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM = 7;

const proposalSetTypeSchema = z.enum([
  'WARMUP',
  'WORKING',
  'BACKOFF',
  'DROP_SET',
  'AMRAP',
  'FAILURE_OPTIONAL',
]);

/** Set compact — conversion déterministe vers WorkoutTemplateSet. */
export const coachProposalSetSchema = z
  .object({
    setType: proposalSetTypeSchema,
    targetRepMin: z.number().int().positive().max(500).nullable(),
    targetRepMax: z.number().int().positive().max(500).nullable(),
    targetDurationSeconds: z.number().int().positive().max(86_400).nullable(),
    targetDistanceMeters: z.number().finite().positive().max(1_000_000).nullable(),
    targetWeightKg: z.number().finite().min(0).max(10_000).nullable(),
    targetIntensityPercent: z.number().finite().gt(0).lte(100).nullable(),
    targetRir: z.number().int().min(0).max(10).nullable(),
    targetRpe: z.number().finite().min(1).max(10).nullable(),
    restSeconds: z.number().int().min(0).max(1800).nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.targetRir != null && data.targetRpe != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RIR et RPE ne peuvent pas être définis simultanément.',
        path: ['targetRir'],
      });
    }
    if (
      (data.targetRepMin == null) !== (data.targetRepMax == null) ||
      (data.targetRepMin != null &&
        data.targetRepMax != null &&
        data.targetRepMin > data.targetRepMax)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plage de répétitions invalide.',
        path: ['targetRepMin'],
      });
    }
  });

export type CoachProposalSet = z.infer<typeof coachProposalSetSchema>;

export const coachProposalExerciseSchema = z
  .object({
    exerciseId: z.string().uuid(),
    equipmentTypeId: z.string().uuid().nullable(),
    notes: z.string().max(500).nullable(),
    sets: z
      .array(coachProposalSetSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_SETS_PER_EXERCISE),
  })
  .strict();

export type CoachProposalExercise = z.infer<typeof coachProposalExerciseSchema>;

export const coachWorkoutProposalSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    estimatedDurationMinutes: z.number().int().min(1).max(600).nullable(),
    exercises: z
      .array(coachProposalExerciseSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_EXERCISES_PER_WORKOUT),
  })
  .strict();

export type CoachWorkoutProposal = z.infer<typeof coachWorkoutProposalSchema>;

export const coachProgramScheduleEntrySchema = z
  .object({
    weekday: z.enum([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]),
    workoutIndex: z.number().int().min(0).max(AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM - 1),
    position: z.number().int().min(0).max(100),
  })
  .strict();

export const coachProgramProposalSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable(),
    goal: z.enum(['ENDURANCE', 'HYPERTROPHY', 'STRENGTH', 'GENERAL_FITNESS']),
    workouts: z
      .array(coachWorkoutProposalSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM),
    schedule: z.array(coachProgramScheduleEntrySchema).max(21).nullable(),
  })
  .strict();

export type CoachProgramProposal = z.infer<typeof coachProgramProposalSchema>;

export const coachProposalDataSchema = z
  .object({
    kind: z.enum(['workout', 'program', 'none']),
    workout: coachWorkoutProposalSchema.nullable(),
    program: coachProgramProposalSchema.nullable(),
  })
  .strict();

export type CoachProposalData = z.infer<typeof coachProposalDataSchema>;

export const coachStructuredResponseSchema = z
  .object({
    type: z.enum(['discussion', 'proposal']),
    text: z.string().trim().min(1).max(AI_COACH_DISCUSSION_TEXT_MAX),
    data: coachProposalDataSchema.nullable(),
    references: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('EXERCISE'),
              exerciseId: z.string().uuid(),
              label: z.string().min(1).max(120),
            })
            .strict(),
          z
            .object({
              type: z.literal('WORKOUT'),
              workoutSessionId: z.string().uuid(),
              label: z.string().min(1).max(120),
            })
            .strict(),
          z
            .object({
              type: z.literal('PROGRESS'),
              exerciseId: z.string().uuid(),
              label: z.string().min(1).max(120),
            })
            .strict(),
        ]),
      )
      .max(8)
      .default([]),
    suggestedFollowUps: z
      .array(z.string().min(1).max(160))
      .max(3)
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'discussion') {
      if (value.data != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Une discussion ne doit pas contenir de data.',
          path: ['data'],
        });
      }
      return;
    }

    // proposal
    if (value.text.length > AI_COACH_PROPOSAL_TEXT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le résumé d’une proposition doit faire ≤ ${AI_COACH_PROPOSAL_TEXT_MAX} caractères.`,
        path: ['text'],
      });
    }
    if (value.data == null || value.data.kind === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Une proposal doit contenir data.kind workout|program.',
        path: ['data'],
      });
      return;
    }
    if (value.data.kind === 'workout') {
      if (value.data.workout == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'data.workout requis pour kind=workout.',
          path: ['data', 'workout'],
        });
      }
      if (value.data.program != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'data.program doit être null pour kind=workout.',
          path: ['data', 'program'],
        });
      }
    }
    if (value.data.kind === 'program') {
      if (value.data.program == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'data.program requis pour kind=program.',
          path: ['data', 'program'],
        });
      }
      if (value.data.workout != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'data.workout doit être null pour kind=program.',
          path: ['data', 'workout'],
        });
      }
      if (value.data.program?.schedule) {
        const maxIndex = value.data.program.workouts.length - 1;
        for (const [i, entry] of value.data.program.schedule.entries()) {
          if (entry.workoutIndex > maxIndex) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'workoutIndex hors bornes.',
              path: ['data', 'program', 'schedule', i, 'workoutIndex'],
            });
          }
        }
      }
    }
  });

export type CoachStructuredResponse = z.infer<
  typeof coachStructuredResponseSchema
>;

export function parseCoachStructuredResponse(
  value: unknown,
): CoachStructuredResponse {
  return coachStructuredResponseSchema.parse(value);
}

export function normalizeProposalText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= AI_COACH_PROPOSAL_TEXT_MAX) return trimmed;
  return `${trimmed.slice(0, AI_COACH_PROPOSAL_TEXT_MAX - 1)}…`;
}

export const acceptCoachProposalBodySchema = z
  .object({
    /** Requis pour kind=workout (WorkoutTemplate appartient à un Program). */
    programId: z.string().uuid().optional(),
  })
  .strict();

export type AcceptCoachProposalInput = z.infer<
  typeof acceptCoachProposalBodySchema
>;
