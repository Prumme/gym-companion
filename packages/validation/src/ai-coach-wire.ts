/**
 * Coach IA — format WIRE compact OpenAI (privé provider).
 *
 * Ce format n’est PAS un contrat frontend ni le modèle métier.
 * Flux : OpenAI wire → validate → mapAiCoachWireResponse → CoachStructuredResponse.
 */

import { z } from 'zod';

import {
  AI_COACH_DISCUSSION_TEXT_MAX,
  AI_COACH_PROPOSAL_MAX_EXERCISES_PER_WORKOUT,
  AI_COACH_PROPOSAL_MAX_SETS_PER_EXERCISE,
  AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM,
  AI_COACH_PROPOSAL_TEXT_MAX,
  normalizeProposalText,
  parseCoachStructuredResponse,
  type CoachStructuredResponse,
} from './ai-coach-structured';

/** Correspondance documentée des clés wire (stable). */
export const AI_COACH_WIRE_KEY_MAP = {
  t: 'type (d=discussion, p=proposal)',
  x: 'text',
  d: 'data',
  k: 'kind (wk=workout, pg=program, none)',
  wk: 'workout',
  pg: 'program',
  n: 'name',
  dur: 'estimatedDurationMinutes',
  e: 'exercises',
  id: 'exerciseId (or session id in refs)',
  eq: 'equipmentTypeId',
  note: 'notes',
  s: 'sets',
  st: 'setType',
  r: 'reps range [min,max]',
  sec: 'targetDurationSeconds',
  m: 'targetDistanceMeters',
  kg: 'targetWeightKg',
  pct: 'targetIntensityPercent',
  rir: 'targetRir',
  rpe: 'targetRpe',
  rest: 'restSeconds',
  desc: 'description',
  goal: 'goal',
  w: 'workouts',
  sch: 'schedule',
  day: 'weekday',
  wi: 'workoutIndex',
  pos: 'position',
  rf: 'references',
  fu: 'suggestedFollowUps',
  l: 'label (reference)',
} as const;

const setTypeWireSchema = z.enum([
  'WARMUP',
  'WORKING',
  'BACKOFF',
  'DROP_SET',
  'AMRAP',
  'FAILURE_OPTIONAL',
]);

const weekdayWireSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const goalWireSchema = z.enum([
  'ENDURANCE',
  'HYPERTROPHY',
  'STRENGTH',
  'GENERAL_FITNESS',
]);

/** Plage reps wire : exactement [min, max]. */
export const aiCoachWireRepsRangeSchema = z
  .tuple([
    z.number().int().positive().max(500),
    z.number().int().positive().max(500),
  ])
  .refine(([min, max]) => min <= max, {
    message: 'reps range: min must be <= max',
  });

export const aiCoachWireSetSchema = z
  .object({
    st: setTypeWireSchema,
    r: aiCoachWireRepsRangeSchema.nullable(),
    sec: z.number().int().positive().max(86_400).nullable(),
    m: z.number().finite().positive().max(1_000_000).nullable(),
    kg: z.number().finite().min(0).max(10_000).nullable(),
    pct: z.number().finite().gt(0).lte(100).nullable(),
    rir: z.number().int().min(0).max(10).nullable(),
    rpe: z.number().finite().min(1).max(10).nullable(),
    rest: z.number().int().min(0).max(1800).nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.rir != null && data.rpe != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rir and rpe cannot both be set',
        path: ['rir'],
      });
    }
  });

export const aiCoachWireExerciseSchema = z
  .object({
    id: z.string().uuid(),
    eq: z.string().uuid().nullable(),
    note: z.string().max(500).nullable(),
    s: z
      .array(aiCoachWireSetSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_SETS_PER_EXERCISE),
  })
  .strict();

export const aiCoachWireWorkoutSchema = z
  .object({
    n: z.string().trim().min(1).max(120),
    dur: z.number().int().min(1).max(600).nullable(),
    e: z
      .array(aiCoachWireExerciseSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_EXERCISES_PER_WORKOUT),
  })
  .strict();

export const aiCoachWireScheduleEntrySchema = z
  .object({
    day: weekdayWireSchema,
    wi: z
      .number()
      .int()
      .min(0)
      .max(AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM - 1),
    pos: z.number().int().min(0).max(100),
  })
  .strict();

export const aiCoachWireProgramSchema = z
  .object({
    n: z.string().trim().min(1).max(120),
    desc: z.string().max(2000).nullable(),
    goal: goalWireSchema,
    w: z
      .array(aiCoachWireWorkoutSchema)
      .min(1)
      .max(AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM),
    sch: z.array(aiCoachWireScheduleEntrySchema).max(21).nullable(),
  })
  .strict();

export const aiCoachWireDataSchema = z
  .object({
    k: z.enum(['wk', 'pg', 'none']),
    wk: aiCoachWireWorkoutSchema.nullable(),
    pg: aiCoachWireProgramSchema.nullable(),
  })
  .strict();

export const aiCoachWireReferenceSchema = z.discriminatedUnion('t', [
  z
    .object({
      t: z.literal('ex'),
      id: z.string().uuid(),
      l: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      t: z.literal('wo'),
      id: z.string().uuid(),
      l: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      t: z.literal('pr'),
      id: z.string().uuid(),
      l: z.string().min(1).max(120),
    })
    .strict(),
]);

export const aiCoachWireResponseSchema = z
  .object({
    t: z.enum(['d', 'p']),
    x: z.string().trim().min(1).max(AI_COACH_DISCUSSION_TEXT_MAX),
    d: aiCoachWireDataSchema.nullable(),
    rf: z.array(aiCoachWireReferenceSchema).max(8).default([]),
    fu: z.array(z.string().min(1).max(160)).max(3).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.t === 'd') {
      if (value.d != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'discussion must have d=null',
          path: ['d'],
        });
      }
      return;
    }
    if (value.x.length > AI_COACH_PROPOSAL_TEXT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `proposal text must be ≤ ${AI_COACH_PROPOSAL_TEXT_MAX}`,
        path: ['x'],
      });
    }
    if (value.d == null || value.d.k === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'proposal requires d.k wk|pg',
        path: ['d'],
      });
      return;
    }
    if (value.d.k === 'wk') {
      if (value.d.wk == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'd.wk required for k=wk',
          path: ['d', 'wk'],
        });
      }
      if (value.d.pg != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'd.pg must be null for k=wk',
          path: ['d', 'pg'],
        });
      }
    }
    if (value.d.k === 'pg') {
      if (value.d.pg == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'd.pg required for k=pg',
          path: ['d', 'pg'],
        });
      }
      if (value.d.wk != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'd.wk must be null for k=pg',
          path: ['d', 'wk'],
        });
      }
      if (value.d.pg?.sch) {
        const maxIndex = value.d.pg.w.length - 1;
        for (const [i, entry] of value.d.pg.sch.entries()) {
          if (entry.wi > maxIndex) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'wi out of bounds',
              path: ['d', 'pg', 'sch', i, 'wi'],
            });
          }
        }
      }
    }
  });

export type AiCoachWireResponse = z.infer<typeof aiCoachWireResponseSchema>;

export function parseAiCoachWireResponse(value: unknown): AiCoachWireResponse {
  return aiCoachWireResponseSchema.parse(value);
}

function mapWireSet(set: z.infer<typeof aiCoachWireSetSchema>) {
  return {
    setType: set.st,
    targetRepMin: set.r?.[0] ?? null,
    targetRepMax: set.r?.[1] ?? null,
    targetDurationSeconds: set.sec,
    targetDistanceMeters: set.m,
    targetWeightKg: set.kg,
    targetIntensityPercent: set.pct,
    targetRir: set.rir,
    targetRpe: set.rpe,
    restSeconds: set.rest,
  };
}

function mapWireWorkout(workout: z.infer<typeof aiCoachWireWorkoutSchema>) {
  return {
    name: workout.n,
    estimatedDurationMinutes: workout.dur,
    exercises: workout.e.map((exercise) => ({
      exerciseId: exercise.id,
      equipmentTypeId: exercise.eq,
      notes: exercise.note,
      sets: exercise.s.map(mapWireSet),
    })),
  };
}

function mapWireProgram(program: z.infer<typeof aiCoachWireProgramSchema>) {
  return {
    name: program.n,
    description: program.desc,
    goal: program.goal,
    workouts: program.w.map(mapWireWorkout),
    schedule:
      program.sch?.map((entry) => ({
        weekday: entry.day,
        workoutIndex: entry.wi,
        position: entry.pos,
      })) ?? null,
  };
}

/**
 * Mappe le wire OpenAI vers le DTO canonique métier.
 * Aucune clé wire ne doit fuir hors de cette frontière.
 */
export function mapAiCoachWireResponse(
  wire: AiCoachWireResponse,
): CoachStructuredResponse {
  const text =
    wire.t === 'p' ? normalizeProposalText(wire.x) : wire.x.trim();

  const references = wire.rf.map((ref) => {
    if (ref.t === 'ex') {
      return {
        type: 'EXERCISE' as const,
        exerciseId: ref.id,
        label: ref.l,
      };
    }
    if (ref.t === 'wo') {
      return {
        type: 'WORKOUT' as const,
        workoutSessionId: ref.id,
        label: ref.l,
      };
    }
    return {
      type: 'PROGRESS' as const,
      exerciseId: ref.id,
      label: ref.l,
    };
  });

  if (wire.t === 'd') {
    return parseCoachStructuredResponse({
      type: 'discussion',
      text,
      data: null,
      references,
      suggestedFollowUps: wire.fu,
    });
  }

  const kind =
    wire.d!.k === 'wk' ? 'workout' : wire.d!.k === 'pg' ? 'program' : 'none';

  return parseCoachStructuredResponse({
    type: 'proposal',
    text,
    data: {
      kind,
      workout: wire.d!.wk ? mapWireWorkout(wire.d!.wk) : null,
      program: wire.d!.pg ? mapWireProgram(wire.d!.pg) : null,
    },
    references,
    suggestedFollowUps: wire.fu,
  });
}

/** Parse wire OpenAI puis mappe vers le canonique (validation Zod double). */
export function parseAiCoachOpenAiWireResponse(
  value: unknown,
): CoachStructuredResponse {
  return mapAiCoachWireResponse(parseAiCoachWireResponse(value));
}

/* -------------------------------------------------------------------------- */
/* JSON Schema Structured Outputs (clés compactes, strict, pas de $ref)       */
/* -------------------------------------------------------------------------- */

const SET_TYPE_ENUM = [
  'WARMUP',
  'WORKING',
  'BACKOFF',
  'DROP_SET',
  'AMRAP',
  'FAILURE_OPTIONAL',
] as const;

function buildWireSetJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      st: { type: 'string', enum: [...SET_TYPE_ENUM] },
      r: {
        anyOf: [
          { type: 'null' },
          {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'integer', minimum: 1, maximum: 500 },
          },
        ],
      },
      sec: {
        anyOf: [
          { type: 'null' },
          { type: 'integer', minimum: 1, maximum: 86400 },
        ],
      },
      m: {
        anyOf: [
          { type: 'null' },
          { type: 'number', exclusiveMinimum: 0, maximum: 1_000_000 },
        ],
      },
      kg: {
        anyOf: [
          { type: 'null' },
          { type: 'number', minimum: 0, maximum: 10_000 },
        ],
      },
      pct: {
        anyOf: [
          { type: 'null' },
          { type: 'number', exclusiveMinimum: 0, maximum: 100 },
        ],
      },
      rir: {
        anyOf: [{ type: 'null' }, { type: 'integer', minimum: 0, maximum: 10 }],
      },
      rpe: {
        anyOf: [{ type: 'null' }, { type: 'number', minimum: 1, maximum: 10 }],
      },
      rest: {
        anyOf: [
          { type: 'null' },
          { type: 'integer', minimum: 0, maximum: 1800 },
        ],
      },
    },
    required: ['st', 'r', 'sec', 'm', 'kg', 'pct', 'rir', 'rpe', 'rest'],
  } as const;
}

function buildWireExerciseJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string', format: 'uuid' },
      eq: { anyOf: [{ type: 'null' }, { type: 'string', format: 'uuid' }] },
      note: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 500 }] },
      s: {
        type: 'array',
        minItems: 1,
        maxItems: AI_COACH_PROPOSAL_MAX_SETS_PER_EXERCISE,
        items: buildWireSetJsonSchema(),
      },
    },
    required: ['id', 'eq', 'note', 's'],
  } as const;
}

function buildWireWorkoutJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      n: { type: 'string', minLength: 1, maxLength: 120 },
      dur: {
        anyOf: [{ type: 'null' }, { type: 'integer', minimum: 1, maximum: 600 }],
      },
      e: {
        type: 'array',
        minItems: 1,
        maxItems: AI_COACH_PROPOSAL_MAX_EXERCISES_PER_WORKOUT,
        items: buildWireExerciseJsonSchema(),
      },
    },
    required: ['n', 'dur', 'e'],
  } as const;
}

/**
 * Schema OpenAI Structured Outputs — clés compactes uniquement.
 * Remplace l’ancien schema aux noms métier longs.
 */
export const AI_COACH_WIRE_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    t: { type: 'string', enum: ['d', 'p'] },
    x: {
      type: 'string',
      minLength: 1,
      maxLength: AI_COACH_DISCUSSION_TEXT_MAX,
    },
    d: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            k: { type: 'string', enum: ['wk', 'pg', 'none'] },
            wk: {
              anyOf: [{ type: 'null' }, buildWireWorkoutJsonSchema()],
            },
            pg: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    n: { type: 'string', minLength: 1, maxLength: 120 },
                    desc: {
                      anyOf: [
                        { type: 'null' },
                        { type: 'string', maxLength: 2000 },
                      ],
                    },
                    goal: {
                      type: 'string',
                      enum: [
                        'ENDURANCE',
                        'HYPERTROPHY',
                        'STRENGTH',
                        'GENERAL_FITNESS',
                      ],
                    },
                    w: {
                      type: 'array',
                      minItems: 1,
                      maxItems: AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM,
                      items: buildWireWorkoutJsonSchema(),
                    },
                    sch: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'array',
                          maxItems: 21,
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              day: {
                                type: 'string',
                                enum: [
                                  'MONDAY',
                                  'TUESDAY',
                                  'WEDNESDAY',
                                  'THURSDAY',
                                  'FRIDAY',
                                  'SATURDAY',
                                  'SUNDAY',
                                ],
                              },
                              wi: {
                                type: 'integer',
                                minimum: 0,
                                maximum:
                                  AI_COACH_PROPOSAL_MAX_WORKOUTS_PER_PROGRAM - 1,
                              },
                              pos: {
                                type: 'integer',
                                minimum: 0,
                                maximum: 100,
                              },
                            },
                            required: ['day', 'wi', 'pos'],
                          },
                        },
                      ],
                    },
                  },
                  required: ['n', 'desc', 'goal', 'w', 'sch'],
                },
              ],
            },
          },
          required: ['k', 'wk', 'pg'],
        },
      ],
    },
    rf: {
      type: 'array',
      maxItems: 8,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              t: { type: 'string', enum: ['ex'] },
              id: { type: 'string', format: 'uuid' },
              l: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['t', 'id', 'l'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              t: { type: 'string', enum: ['wo'] },
              id: { type: 'string', format: 'uuid' },
              l: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['t', 'id', 'l'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              t: { type: 'string', enum: ['pr'] },
              id: { type: 'string', format: 'uuid' },
              l: { type: 'string', minLength: 1, maxLength: 120 },
            },
            required: ['t', 'id', 'l'],
          },
        ],
      },
    },
    fu: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', minLength: 1, maxLength: 160 },
    },
  },
  required: ['t', 'x', 'd', 'rf', 'fu'],
} as const;

/**
 * @deprecated Alias — le schema OpenAI est désormais le wire compact.
 * Conservé pour éviter de casser les imports existants.
 */
export const COACH_STRUCTURED_OUTPUT_JSON_SCHEMA =
  AI_COACH_WIRE_OUTPUT_JSON_SCHEMA;

/** Budgets max_tokens Chat Completions (réponse finale). */
export const AI_COACH_WIRE_MAX_TOKENS = {
  discussion: 900,
  workout: 2800,
  /** Programme = cas le plus coûteux ; marge anti-troncature. */
  program: 4500,
  /** Défaut quand le type n’est pas encore connu (avant génération). */
  finalDefault: 4500,
} as const;

/**
 * Proxy de comparaison de taille : JSON canonique vs wire pour une même
 * proposition (fixture). Utile pour mesurer l’économie de caractères/tokens
 * approximative sans appeler OpenAI.
 */
export function estimateWireSavingsChars(canonicalJson: string, wireJson: string): {
  canonicalChars: number;
  wireChars: number;
  savedChars: number;
  savedRatio: number;
} {
  const canonicalChars = canonicalJson.length;
  const wireChars = wireJson.length;
  const savedChars = Math.max(0, canonicalChars - wireChars);
  return {
    canonicalChars,
    wireChars,
    savedChars,
    savedRatio: canonicalChars === 0 ? 0 : savedChars / canonicalChars,
  };
}
