import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_APP_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SECRET: z.string().min(32),
  EMAIL_PROVIDER: z.enum(['mailpit', 'none']).default('none'),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_VERIFICATION_REQUIRED: booleanFromString.default(false),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const webEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_PUBLIC_APP_URL: z.string().url(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment variables: ${details}`);
  }
  return result.data;
}

export function parseWebEnv(env: Record<string, string | undefined>): WebEnv {
  const result = webEnvSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid web environment variables: ${details}`);
  }
  return result.data;
}

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  acceptedTermsVersion: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const weightUnitSchema = z.enum(['KG', 'LB']);
export const distanceUnitSchema = z.enum(['KM', 'MI']);
export const trainingGoalSchema = z.enum([
  'ENDURANCE',
  'HYPERTROPHY',
  'STRENGTH',
  'GENERAL_FITNESS',
]);
export const experienceLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export const effortTrackingModeSchema = z.enum(['NONE', 'RIR', 'RPE']);

function normalizeOptionalNumber(
  value: string | number | null | undefined,
  max: number,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === '' || value === null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) {
    return null;
  }
  return parsed;
}

/** Schéma du formulaire profil (champs visibles Phase 0). */
export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Le nom affiché est requis.')
    .max(80, 'Le nom affiché est trop long.'),
  timezone: z.string().trim().min(1, 'Le fuseau horaire est requis.'),
  weightUnit: weightUnitSchema,
  distanceUnit: distanceUnitSchema,
  primaryGoal: trainingGoalSchema,
  experienceLevel: experienceLevelSchema,
  effortTrackingMode: effortTrackingModeSchema,
  heightCm: z.union([z.string(), z.number(), z.null()]).optional(),
  currentWeightKg: z.union([z.string(), z.number(), z.null()]).optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** Payload PATCH aligné sur le contrat API. */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().min(1).optional(),
  weightUnit: weightUnitSchema.optional(),
  distanceUnit: distanceUnitSchema.optional(),
  primaryGoal: trainingGoalSchema.optional(),
  experienceLevel: experienceLevelSchema.optional(),
  effortTrackingMode: effortTrackingModeSchema.optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  currentWeightKg: z.number().positive().max(500).nullable().optional(),
  weeklyTrainingTarget: z.number().int().positive().max(14).nullable().optional(),
  defaultWorkoutDurationMinutes: z.number().int().positive().max(600).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export function toUpdateProfilePayload(values: ProfileFormValues): UpdateProfileInput {
  const payload: UpdateProfileInput = {
    displayName: values.displayName.trim(),
    timezone: values.timezone.trim(),
    weightUnit: values.weightUnit,
    distanceUnit: values.distanceUnit,
    primaryGoal: values.primaryGoal,
    experienceLevel: values.experienceLevel,
    effortTrackingMode: values.effortTrackingMode,
  };

  if (values.heightCm !== undefined) {
    payload.heightCm = normalizeOptionalNumber(values.heightCm, 300) ?? null;
  }
  if (values.currentWeightKg !== undefined) {
    payload.currentWeightKg = normalizeOptionalNumber(values.currentWeightKg, 500) ?? null;
  }

  return payload;
}

export const exerciseSourceSchema = z.enum(['SYSTEM', 'USER']);
export const exerciseMeasurementTypeSchema = z.enum([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

const emptyToNull = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const compatibleEquipmentInputSchema = z.object({
  equipmentTypeId: z.string().uuid(),
  isPreferred: z.boolean().default(false),
  notes: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : emptyToNull(value) ?? null)),
});

const createExerciseObjectSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(120),
  primaryMuscleGroupId: z.string().uuid(),
  secondaryMuscleGroupIds: z.array(z.string().uuid()).default([]),
  measurementType: exerciseMeasurementTypeSchema,
  defaultEquipmentTypeId: z.string().uuid().nullable().optional(),
  compatibleEquipmentTypes: z.array(compatibleEquipmentInputSchema).default([]),
  defaultRestSeconds: z.number().int().min(0).max(3600).nullable().optional(),
  instructions: z
    .string()
    .max(4000)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : emptyToNull(value) ?? null)),
});

function refineExercisePayload(
  data: {
    primaryMuscleGroupId?: string;
    secondaryMuscleGroupIds?: string[];
    defaultEquipmentTypeId?: string | null;
    compatibleEquipmentTypes?: Array<{
      equipmentTypeId: string;
      isPreferred: boolean;
      notes?: string | null;
    }>;
  },
  ctx: z.RefinementCtx,
) {
  const secondary = data.secondaryMuscleGroupIds ?? [];
  if (new Set(secondary).size !== secondary.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secondaryMuscleGroupIds'],
      message: 'Groupes musculaires secondaires en double.',
    });
  }
  if (data.primaryMuscleGroupId && secondary.includes(data.primaryMuscleGroupId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secondaryMuscleGroupIds'],
      message: 'Le groupe principal ne peut pas être secondaire.',
    });
  }

  const equipmentIds = (data.compatibleEquipmentTypes ?? []).map(
    (item) => item.equipmentTypeId,
  );
  if (new Set(equipmentIds).size !== equipmentIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['compatibleEquipmentTypes'],
      message: 'Types d’équipement compatibles en double.',
    });
  }

  const preferredCount = (data.compatibleEquipmentTypes ?? []).filter(
    (item) => item.isPreferred,
  ).length;
  if (preferredCount > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['compatibleEquipmentTypes'],
      message: 'Un seul type d’équipement peut être préféré.',
    });
  }

  if (
    data.defaultEquipmentTypeId &&
    data.compatibleEquipmentTypes &&
    !equipmentIds.includes(data.defaultEquipmentTypeId)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultEquipmentTypeId'],
      message: 'L’équipement par défaut doit être compatible.',
    });
  }
}

export const createExerciseSchema = createExerciseObjectSchema.superRefine(
  refineExercisePayload,
);

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = createExerciseObjectSchema
  .partial()
  .superRefine(refineExercisePayload);
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

/** Normalise un nom d’exercice pour détection de doublons. */
export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

/**
 * Parse un booléen depuis une query string.
 * N’utilise pas `Boolean("false")` (qui retournerait true).
 */
export const queryBooleanSchema = z.preprocess(
  emptyQueryToUndefined,
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return false;
      }
      if (typeof value === 'boolean') {
        return value;
      }
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valeur booléenne invalide.',
      });
      return z.NEVER;
    }),
);

export type ExerciseCursorPayload = {
  version: 1;
  normalizedName: string;
  id: string;
};

export function encodeExerciseCursor(payload: ExerciseCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeExerciseCursor(cursor: string): ExerciseCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('EXERCISE_INVALID_CURSOR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { normalizedName?: unknown }).normalizedName !== 'string' ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    (parsed as { normalizedName: string }).normalizedName.length === 0 ||
    (parsed as { id: string }).id.length === 0
  ) {
    throw new Error('EXERCISE_INVALID_CURSOR');
  }

  return {
    version: 1,
    normalizedName: (parsed as { normalizedName: string }).normalizedName,
    id: (parsed as { id: string }).id,
  };
}

/** Condition Prisma/SQL conceptuelle pour poursuivre après un cursor (normalizedName, id). */
export function buildExerciseCursorFilter(cursor: ExerciseCursorPayload): {
  OR: Array<
    | { normalizedName: { gt: string } }
    | { AND: [{ normalizedName: string }, { id: { gt: string } }] }
  >;
} {
  return {
    OR: [
      { normalizedName: { gt: cursor.normalizedName } },
      {
        AND: [
          { normalizedName: cursor.normalizedName },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

const listExercisesLimitSchema = z.preprocess(
  emptyQueryToUndefined,
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return 20;
      }
      if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'limit doit être un entier.',
          });
          return z.NEVER;
        }
        return value;
      }
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'limit doit être un entier.',
        });
        return z.NEVER;
      }
      return Number(trimmed);
    })
    .pipe(z.number().int().min(1).max(100)),
);

export const listExercisesQuerySchema = z.object({
  search: z.preprocess(emptyQueryToUndefined, z.string().max(100).optional()).transform(
    (value) => {
      if (value === undefined) {
        return undefined;
      }
      const normalized = normalizeExerciseName(value);
      return normalized.length === 0 ? undefined : normalized;
    },
  ),
  muscleGroupId: z.preprocess(
    emptyQueryToUndefined,
    z.string().uuid().optional(),
  ),
  equipmentTypeId: z.preprocess(
    emptyQueryToUndefined,
    z.string().uuid().optional(),
  ),
  measurementType: z.preprocess(
    emptyQueryToUndefined,
    exerciseMeasurementTypeSchema.optional(),
  ),
  source: z.preprocess(emptyQueryToUndefined, exerciseSourceSchema.optional()),
  includeArchived: queryBooleanSchema,
  favoriteOnly: queryBooleanSchema,
  cursor: z.preprocess(emptyQueryToUndefined, z.string().min(1).optional()),
  limit: listExercisesLimitSchema,
});

export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export const updateExercisePreferenceSchema = z
  .object({
    isFavorite: z.boolean(),
    isExcludedFromSuggestions: z.boolean(),
    preferredEquipmentTypeId: z.preprocess(
      (value) => (value === '' ? null : value),
      z.string().uuid().nullable(),
    ),
    restSecondsOverride: z.number().int().min(0).max(1800).nullable(),
  })
  .strict();

export type UpdateExercisePreferenceInput = z.infer<
  typeof updateExercisePreferenceSchema
>;

/** True si le payload correspond aux préférences effectives par défaut. */
export function isDefaultExercisePreferenceInput(
  input: UpdateExercisePreferenceInput,
): boolean {
  return (
    input.isFavorite === false &&
    input.isExcludedFromSuggestions === false &&
    input.preferredEquipmentTypeId === null &&
    input.restSecondsOverride === null
  );
}

const optionalNullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : emptyToNull(value) ?? null));

export const createProgramSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(120),
  description: optionalNullableText(2000),
  goal: trainingGoalSchema,
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema.partial();
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const createWorkoutTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(120),
  description: optionalNullableText(2000),
  estimatedDurationMinutes: z
    .number()
    .int()
    .min(1, 'La durée doit être au moins 1 minute.')
    .max(600, 'La durée ne peut pas dépasser 600 minutes.')
    .nullable()
    .optional(),
});

export type CreateWorkoutTemplateInput = z.infer<typeof createWorkoutTemplateSchema>;

export const updateWorkoutTemplateSchema = createWorkoutTemplateSchema.partial();
export type UpdateWorkoutTemplateInput = z.infer<typeof updateWorkoutTemplateSchema>;

export const reorderWorkoutTemplatesSchema = z.object({
  workoutTemplateIds: z
    .array(z.string().uuid())
    .min(1, 'La liste d’ordre ne peut pas être vide.'),
});

export type ReorderWorkoutTemplatesInput = z.infer<
  typeof reorderWorkoutTemplatesSchema
>;

export const listProgramsLimitSchema = z.preprocess(
  emptyQueryToUndefined,
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return 20;
      }
      if (typeof value === 'number') {
        return value;
      }
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'limit doit être un entier.',
        });
        return z.NEVER;
      }
      return Number(trimmed);
    })
    .pipe(z.number().int().min(1).max(100)),
);

export const listProgramsQuerySchema = z.object({
  includeArchived: queryBooleanSchema,
  cursor: z.preprocess(emptyQueryToUndefined, z.string().min(1).optional()),
  limit: listProgramsLimitSchema,
});

export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;

export type ProgramCursorPayload = {
  version: 1;
  updatedAt: string;
  id: string;
};

export function encodeProgramCursor(payload: ProgramCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeProgramCursor(cursor: string): ProgramCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('PROGRAM_INVALID_CURSOR');
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
    throw new Error('PROGRAM_INVALID_CURSOR');
  }

  return {
    version: 1,
    updatedAt: (parsed as { updatedAt: string }).updatedAt,
    id: (parsed as { id: string }).id,
  };
}

/** Cursor sur tri `updatedAt desc, id desc`. */
export function buildProgramCursorFilter(cursor: ProgramCursorPayload): {
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

/**
 * Positions ordonnées : convention 0-based (0, 1, 2, …).
 * Réutilisé pour modèles, exercices de modèle et séries cibles.
 */
export function computeNextOrderedPosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) {
    return 0;
  }
  return Math.max(...existingPositions) + 1;
}

export function compactOrderedPositions(
  orderedIds: string[],
): Array<{ id: string; position: number }> {
  return orderedIds.map((id, position) => ({ id, position }));
}

export type OrderedIdsValidationReason =
  | 'DUPLICATE'
  | 'INCOMPLETE'
  | 'INVALID';

export function validateOrderedIds(
  requestedIds: string[],
  existingIds: string[],
): { ok: true } | { ok: false; reason: OrderedIdsValidationReason } {
  if (new Set(requestedIds).size !== requestedIds.length) {
    return { ok: false, reason: 'DUPLICATE' };
  }
  if (requestedIds.length !== existingIds.length) {
    return { ok: false, reason: 'INCOMPLETE' };
  }
  const existing = new Set(existingIds);
  for (const id of requestedIds) {
    if (!existing.has(id)) {
      return { ok: false, reason: 'INVALID' };
    }
  }
  return { ok: true };
}

/** @deprecated Prefer computeNextOrderedPosition */
export function computeNextWorkoutTemplatePosition(
  existingPositions: number[],
): number {
  return computeNextOrderedPosition(existingPositions);
}

/** @deprecated Prefer compactOrderedPositions */
export function compactWorkoutTemplatePositions(
  orderedIds: string[],
): Array<{ id: string; position: number }> {
  return compactOrderedPositions(orderedIds);
}

export type ReorderValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER'
        | 'WORKOUT_TEMPLATE_ORDER_INCOMPLETE'
        | 'WORKOUT_TEMPLATE_INVALID_ORDER';
    };

export function validateWorkoutTemplateReorder(
  requestedIds: string[],
  existingIds: string[],
): ReorderValidationResult {
  const result = validateOrderedIds(requestedIds, existingIds);
  if (result.ok) {
    return { ok: true };
  }
  const codeByReason = {
    DUPLICATE: 'WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER',
    INCOMPLETE: 'WORKOUT_TEMPLATE_ORDER_INCOMPLETE',
    INVALID: 'WORKOUT_TEMPLATE_INVALID_ORDER',
  } as const;
  return { ok: false, code: codeByReason[result.reason] };
}

export const workoutSetTypeSchema = z.enum([
  'WARMUP',
  'WORKING',
  'BACKOFF',
  'DROP_SET',
  'AMRAP',
  'FAILURE_OPTIONAL',
]);

const restSecondsSchema = z
  .number()
  .int()
  .min(0)
  .max(1800)
  .nullable();

const notesSchema = z
  .string()
  .max(2000)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : emptyToNull(value) ?? null));

export const addWorkoutTemplateExerciseSchema = z
  .object({
    exerciseId: z.string().uuid(),
    equipmentTypeId: z.preprocess(
      (value) => (value === '' ? null : value),
      z.string().uuid().nullable(),
    ),
    restSecondsOverride: restSecondsSchema,
    notes: z
      .string()
      .max(2000)
      .nullable()
      .transform((value) => emptyToNull(value) ?? null),
  })
  .strict();

export type AddWorkoutTemplateExerciseInput = z.infer<
  typeof addWorkoutTemplateExerciseSchema
>;

export const updateWorkoutTemplateExerciseSchema = z
  .object({
    equipmentTypeId: z.preprocess(
      (value) => (value === '' ? null : value),
      z.string().uuid().nullable(),
    ).optional(),
    restSecondsOverride: restSecondsSchema.optional(),
    notes: notesSchema,
  })
  .strict();

export type UpdateWorkoutTemplateExerciseInput = z.infer<
  typeof updateWorkoutTemplateExerciseSchema
>;

export const reorderWorkoutTemplateExercisesSchema = z
  .object({
    workoutTemplateExerciseIds: z
      .array(z.string().uuid())
      .min(1, 'La liste d’ordre ne peut pas être vide.'),
  })
  .strict();

export type ReorderWorkoutTemplateExercisesInput = z.infer<
  typeof reorderWorkoutTemplateExercisesSchema
>;

const nullablePositiveInt = z.number().int().positive().max(500).nullable();
const nullableNonNegativeDecimal = z.number().finite().min(0).nullable();
const nullablePositiveDuration = z.number().int().positive().max(86_400).nullable();
const nullablePositiveDistance = z.number().finite().positive().max(1_000_000).nullable();

export const workoutTemplateSetTargetsObjectSchema = z
  .object({
    setType: workoutSetTypeSchema,
    targetRepMin: nullablePositiveInt,
    targetRepMax: nullablePositiveInt,
    targetDurationSeconds: nullablePositiveDuration,
    targetDistanceMeters: nullablePositiveDistance,
    targetWeightKg: nullableNonNegativeDecimal,
    targetIntensityPercent: z.number().finite().gt(0).lte(100).nullable(),
    targetRir: z.number().int().min(0).max(10).nullable(),
    targetRpe: z.number().finite().min(1).max(10).nullable(),
    restSeconds: restSecondsSchema,
  })
  .strict();

export const createWorkoutTemplateSetSchema = workoutTemplateSetTargetsObjectSchema;
export type CreateWorkoutTemplateSetInput = z.infer<
  typeof createWorkoutTemplateSetSchema
>;

export const updateWorkoutTemplateSetSchema =
  workoutTemplateSetTargetsObjectSchema.partial().strict();
export type UpdateWorkoutTemplateSetInput = z.infer<
  typeof updateWorkoutTemplateSetSchema
>;

export const reorderWorkoutTemplateSetsSchema = z
  .object({
    setIds: z.array(z.string().uuid()).min(1, 'La liste d’ordre ne peut pas être vide.'),
  })
  .strict();

export type ReorderWorkoutTemplateSetsInput = z.infer<
  typeof reorderWorkoutTemplateSetsSchema
>;

export type WorkoutTemplateSetTargetFields = {
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetWeightKg: number | null;
  targetIntensityPercent: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
};

export type WorkoutTemplateSetValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'WORKOUT_TEMPLATE_SET_INVALID_TARGET'
        | 'WORKOUT_TEMPLATE_SET_INVALID_REP_RANGE'
        | 'WORKOUT_TEMPLATE_SET_CONFLICTING_INTENSITY_TARGETS';
      message: string;
    };

/**
 * Valide les cibles d’une série selon le type de mesure de l’exercice.
 * Règle RIR/RPE : une seule des deux valeurs peut être renseignée.
 */
export function validateWorkoutTemplateSetTargets(
  measurementType:
    | 'WEIGHT_REPS'
    | 'BODYWEIGHT_REPS'
    | 'ASSISTED_BODYWEIGHT_REPS'
    | 'REPS_ONLY'
    | 'DURATION'
    | 'DISTANCE_DURATION'
    | 'WEIGHT_DURATION',
  targets: WorkoutTemplateSetTargetFields,
): WorkoutTemplateSetValidationResult {
  if (targets.targetRir != null && targets.targetRpe != null) {
    return {
      ok: false,
      code: 'WORKOUT_TEMPLATE_SET_CONFLICTING_INTENSITY_TARGETS',
      message: 'Une série ne peut pas définir RIR et RPE simultanément.',
    };
  }

  if (
    (targets.targetRepMin == null) !== (targets.targetRepMax == null) ||
    (targets.targetRepMin != null &&
      targets.targetRepMax != null &&
      targets.targetRepMin > targets.targetRepMax)
  ) {
    return {
      ok: false,
      code: 'WORKOUT_TEMPLATE_SET_INVALID_REP_RANGE',
      message: 'La plage de répétitions est invalide.',
    };
  }

  const hasReps = targets.targetRepMin != null && targets.targetRepMax != null;
  const hasDuration = targets.targetDurationSeconds != null;
  const hasDistance = targets.targetDistanceMeters != null;

  switch (measurementType) {
    case 'WEIGHT_REPS':
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      if (!hasReps) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Une cible de répétitions est requise pour ce type de mesure.',
        };
      }
      if (hasDuration || hasDistance) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Durée et distance ne s’appliquent pas à ce type de mesure.',
        };
      }
      break;
    case 'DURATION':
    case 'WEIGHT_DURATION':
      if (!hasDuration) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Une durée cible est requise pour ce type de mesure.',
        };
      }
      if (hasReps || hasDistance) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Répétitions et distance ne s’appliquent pas à ce type de mesure.',
        };
      }
      break;
    case 'DISTANCE_DURATION':
      if (!hasDistance) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Une distance cible est requise pour ce type de mesure.',
        };
      }
      if (hasReps) {
        return {
          ok: false,
          code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
          message: 'Les répétitions ne s’appliquent pas à ce type de mesure.',
        };
      }
      break;
    default:
      return {
        ok: false,
        code: 'WORKOUT_TEMPLATE_SET_INVALID_TARGET',
        message: 'Type de mesure non supporté.',
      };
  }

  return { ok: true };
}

export type WorkoutTemplateExerciseReorderValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'WORKOUT_TEMPLATE_EXERCISE_DUPLICATE_IN_ORDER'
        | 'WORKOUT_TEMPLATE_EXERCISE_ORDER_INCOMPLETE'
        | 'WORKOUT_TEMPLATE_EXERCISE_INVALID_ORDER';
    };

export function validateWorkoutTemplateExerciseReorder(
  requestedIds: string[],
  existingIds: string[],
): WorkoutTemplateExerciseReorderValidationResult {
  const result = validateOrderedIds(requestedIds, existingIds);
  if (result.ok) {
    return { ok: true };
  }
  const codeByReason = {
    DUPLICATE: 'WORKOUT_TEMPLATE_EXERCISE_DUPLICATE_IN_ORDER',
    INCOMPLETE: 'WORKOUT_TEMPLATE_EXERCISE_ORDER_INCOMPLETE',
    INVALID: 'WORKOUT_TEMPLATE_EXERCISE_INVALID_ORDER',
  } as const;
  return { ok: false, code: codeByReason[result.reason] };
}

export type WorkoutTemplateSetReorderValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'WORKOUT_TEMPLATE_SET_DUPLICATE_IN_ORDER'
        | 'WORKOUT_TEMPLATE_SET_ORDER_INCOMPLETE'
        | 'WORKOUT_TEMPLATE_SET_INVALID_ORDER';
    };

export function validateWorkoutTemplateSetReorder(
  requestedIds: string[],
  existingIds: string[],
): WorkoutTemplateSetReorderValidationResult {
  const result = validateOrderedIds(requestedIds, existingIds);
  if (result.ok) {
    return { ok: true };
  }
  const codeByReason = {
    DUPLICATE: 'WORKOUT_TEMPLATE_SET_DUPLICATE_IN_ORDER',
    INCOMPLETE: 'WORKOUT_TEMPLATE_SET_ORDER_INCOMPLETE',
    INVALID: 'WORKOUT_TEMPLATE_SET_INVALID_ORDER',
  } as const;
  return { ok: false, code: codeByReason[result.reason] };
}

const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const weekdaySchema = z.enum(WEEKDAYS);
export type WeekdayInput = z.infer<typeof weekdaySchema>;

export function isValidLocalDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Date locale YYYY-MM-DD → Date UTC à minuit pour stockage `@db.Date`. */
export function localDateStringToUtcDate(value: string): Date {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date Prisma `@db.Date` → YYYY-MM-DD sans décalage silencieux. */
export function utcDateToLocalDateString(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayLocalDateString(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format YYYY-MM-DD.')
  .refine(isValidLocalDateString, 'La date locale est invalide.');

export const activateProgramSchema = z
  .object({
    startedOn: localDateSchema,
    replaceCurrentProgram: z.boolean(),
  })
  .strict();

export type ActivateProgramInput = z.infer<typeof activateProgramSchema>;

export const replaceProgramScheduleEntrySchema = z
  .object({
    workoutTemplateId: z.string().uuid(),
    weekday: weekdaySchema,
    position: z.number().int().min(0).max(100),
  })
  .strict();

export const replaceProgramScheduleSchema = z
  .object({
    entries: z.array(replaceProgramScheduleEntrySchema),
  })
  .strict();

export type ReplaceProgramScheduleInput = z.infer<
  typeof replaceProgramScheduleSchema
>;

/**
 * Création d’une séance active depuis un modèle.
 * Le client n’envoie jamais le contenu du snapshot — le serveur le construit.
 */
export const createWorkoutSessionSchema = z
  .object({
    sourceWorkoutTemplateId: z
      .string()
      .uuid('L’identifiant du modèle de séance est invalide.'),
    localDate: localDateSchema,
    timezone: z
      .string()
      .trim()
      .min(1, 'Le fuseau horaire est requis.')
      .max(64, 'Le fuseau horaire est trop long.'),
  })
  .strict();

export type CreateWorkoutSessionInput = z.infer<
  typeof createWorkoutSessionSchema
>;

export type ProgramScheduleValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'PROGRAM_SCHEDULE_INVALID'
        | 'PROGRAM_SCHEDULE_INVALID_POSITION'
        | 'PROGRAM_SCHEDULE_DUPLICATE_POSITION';
      message: string;
    };

export function validateProgramScheduleEntries(
  entries: Array<{ weekday: string; position: number; workoutTemplateId: string }>,
): ProgramScheduleValidationResult {
  const byWeekday = new Map<string, number[]>();
  for (const entry of entries) {
    if (!WEEKDAYS.includes(entry.weekday as (typeof WEEKDAYS)[number])) {
      return {
        ok: false,
        code: 'PROGRAM_SCHEDULE_INVALID',
        message: 'Jour de la semaine invalide.',
      };
    }
    if (!Number.isInteger(entry.position) || entry.position < 0) {
      return {
        ok: false,
        code: 'PROGRAM_SCHEDULE_INVALID_POSITION',
        message: 'La position doit être un entier positif ou nul.',
      };
    }
    const list = byWeekday.get(entry.weekday) ?? [];
    list.push(entry.position);
    byWeekday.set(entry.weekday, list);
  }

  for (const [weekday, positions] of byWeekday.entries()) {
    const sorted = [...positions].sort((a, b) => a - b);
    const unique = new Set(sorted);
    if (unique.size !== sorted.length) {
      return {
        ok: false,
        code: 'PROGRAM_SCHEDULE_DUPLICATE_POSITION',
        message: `Positions dupliquées pour ${weekday}.`,
      };
    }
    for (let index = 0; index < sorted.length; index += 1) {
      if (sorted[index] !== index) {
        return {
          ok: false,
          code: 'PROGRAM_SCHEDULE_INVALID_POSITION',
          message: `Les positions de ${weekday} doivent être compactes (0, 1, 2…).`,
        };
      }
    }
  }

  return { ok: true };
}


export const workoutSetStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
]);

const actualRepsSchema = z.number().int().min(0).max(10_000).nullable();
const actualWeightSchema = z.number().finite().min(0).max(10_000).nullable();
const actualDurationSchema = z.number().int().min(0).max(86_400).nullable();
const actualDistanceSchema = z.number().finite().min(0).max(1_000_000).nullable();
const actualRirSchema = z.number().int().min(0).max(10).nullable();
const actualRpeSchema = z.number().finite().min(1).max(10).nullable();

const setNotesSchema = z.string().max(2000).nullable();

export const updateWorkoutSetSchema = z
  .object({
    status: workoutSetStatusSchema,
    actualWeightKg: actualWeightSchema,
    actualReps: actualRepsSchema,
    actualDurationSeconds: actualDurationSchema,
    actualDistanceMeters: actualDistanceSchema,
    actualRir: actualRirSchema,
    actualRpe: actualRpeSchema,
    reachedFailure: z.boolean(),
    notes: setNotesSchema,
    expectedVersion: z.number().int().min(1).max(1_000_000_000),
    clientCommandId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/, 'Identifiant de commande invalide.')
      .optional(),
  })
  .strict();

export type UpdateWorkoutSetInput = z.infer<typeof updateWorkoutSetSchema>;

export type WorkoutSetActualFields = {
  status: z.infer<typeof workoutSetStatusSchema>;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  notes: string | null;
};

export type WorkoutSetActualValidationResult =
  | { ok: true; normalized: WorkoutSetActualFields }
  | {
      ok: false;
      code:
        | 'WORKOUT_SET_INVALID'
        | 'WORKOUT_SET_INVALID_STATUS'
        | 'WORKOUT_SET_MEASUREMENT_MISMATCH'
        | 'WORKOUT_SET_CONFLICTING_EFFORT_VALUES';
      message: string;
    };

type MeasurementType =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'ASSISTED_BODYWEIGHT_REPS'
  | 'REPS_ONLY'
  | 'DURATION'
  | 'DISTANCE_DURATION'
  | 'WEIGHT_DURATION';

function hasPrincipalValue(
  measurementType: MeasurementType,
  values: WorkoutSetActualFields,
): boolean {
  switch (measurementType) {
    case 'WEIGHT_REPS':
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      return values.actualReps != null;
    case 'DURATION':
    case 'WEIGHT_DURATION':
      return values.actualDurationSeconds != null;
    case 'DISTANCE_DURATION':
      return values.actualDistanceMeters != null;
    default:
      return false;
  }
}

function forbidExtras(
  measurementType: MeasurementType,
  values: WorkoutSetActualFields,
): WorkoutSetActualValidationResult | null {
  const forbid = (condition: boolean, message: string) => {
    if (condition) {
      return {
        ok: false as const,
        code: 'WORKOUT_SET_MEASUREMENT_MISMATCH' as const,
        message,
      };
    }
    return null;
  };

  switch (measurementType) {
    case 'WEIGHT_REPS':
      return (
        forbid(
          values.actualDurationSeconds != null,
          'Une série poids/répétitions ne doit pas avoir de durée réelle.',
        ) ??
        forbid(
          values.actualDistanceMeters != null,
          'Une série poids/répétitions ne doit pas avoir de distance réelle.',
        )
      );
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
      return (
        forbid(
          values.actualDurationSeconds != null,
          'Ce type de mesure ne doit pas avoir de durée réelle.',
        ) ??
        forbid(
          values.actualDistanceMeters != null,
          'Ce type de mesure ne doit pas avoir de distance réelle.',
        )
      );
    case 'REPS_ONLY':
      return (
        forbid(
          values.actualWeightKg != null,
          'Une série répétitions seules ne doit pas avoir de charge réelle.',
        ) ??
        forbid(
          values.actualDurationSeconds != null,
          'Une série répétitions seules ne doit pas avoir de durée réelle.',
        ) ??
        forbid(
          values.actualDistanceMeters != null,
          'Une série répétitions seules ne doit pas avoir de distance réelle.',
        )
      );
    case 'DURATION':
      return (
        forbid(
          values.actualReps != null,
          'Une série durée ne doit pas avoir de répétitions réelles.',
        ) ??
        forbid(
          values.actualWeightKg != null,
          'Une série durée ne doit pas avoir de charge réelle.',
        ) ??
        forbid(
          values.actualDistanceMeters != null,
          'Une série durée ne doit pas avoir de distance réelle.',
        )
      );
    case 'DISTANCE_DURATION':
      return forbid(
        values.actualReps != null || values.actualWeightKg != null,
        'Une série distance/durée ne doit pas avoir de répétitions ou de charge.',
      );
    case 'WEIGHT_DURATION':
      return (
        forbid(
          values.actualReps != null,
          'Une série poids/durée ne doit pas avoir de répétitions réelles.',
        ) ??
        forbid(
          values.actualDistanceMeters != null,
          'Une série poids/durée ne doit pas avoir de distance réelle.',
        )
      );
    default:
      return {
        ok: false,
        code: 'WORKOUT_SET_INVALID',
        message: 'Type de mesure inconnu.',
      };
  }
}

/**
 * Valide les valeurs réelles d’une série selon le type de mesure du snapshot
 * et le statut demandé. Normalise SKIPPED/PENDING (efface les actuals).
 *
 * ASSISTED_BODYWEIGHT_REPS : `actualWeightKg` représente une assistance éventuelle
 * (même colonne que la charge additionnelle), sans poids corporel implicite.
 */
export function validateWorkoutSetActuals(
  measurementType: MeasurementType,
  input: WorkoutSetActualFields,
): WorkoutSetActualValidationResult {
  if (input.status === 'CANCELLED') {
    return {
      ok: false,
      code: 'WORKOUT_SET_INVALID_STATUS',
      message:
        'Le statut CANCELLED n’est pas disponible pour la saisie manuelle d’une série.',
    };
  }

  if (input.actualRir != null && input.actualRpe != null) {
    return {
      ok: false,
      code: 'WORKOUT_SET_CONFLICTING_EFFORT_VALUES',
      message: 'Une série ne peut pas définir RIR et RPE simultanément.',
    };
  }

  if (input.status === 'PENDING' || input.status === 'SKIPPED') {
    if (
      input.actualWeightKg != null ||
      input.actualReps != null ||
      input.actualDurationSeconds != null ||
      input.actualDistanceMeters != null ||
      input.actualRir != null ||
      input.actualRpe != null
    ) {
      return {
        ok: false,
        code: 'WORKOUT_SET_INVALID',
        message:
          input.status === 'SKIPPED'
            ? 'Une série ignorée ne doit pas contenir de valeurs réelles.'
            : 'Une série à faire ne doit pas contenir de valeurs réelles.',
      };
    }
    return {
      ok: true,
      normalized: {
        status: input.status,
        actualWeightKg: null,
        actualReps: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        actualRir: null,
        actualRpe: null,
        reachedFailure: false,
        notes: input.notes,
      },
    };
  }

  const extras = forbidExtras(measurementType, input);
  if (extras) {
    return extras;
  }

  if (input.status === 'PARTIAL') {
    if (!hasPrincipalValue(measurementType, input)) {
      return {
        ok: false,
        code: 'WORKOUT_SET_INVALID',
        message:
          'Une série partielle doit contenir au moins une valeur réelle principale.',
      };
    }
    return { ok: true, normalized: input };
  }

  switch (measurementType) {
    case 'WEIGHT_REPS':
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      if (input.actualReps == null) {
        return {
          ok: false,
          code: 'WORKOUT_SET_INVALID',
          message: 'Les répétitions réelles sont requises.',
        };
      }
      break;
    case 'DURATION':
    case 'WEIGHT_DURATION':
      if (input.actualDurationSeconds == null) {
        return {
          ok: false,
          code: 'WORKOUT_SET_INVALID',
          message: 'La durée réelle est requise.',
        };
      }
      break;
    case 'DISTANCE_DURATION':
      if (input.actualDistanceMeters == null) {
        return {
          ok: false,
          code: 'WORKOUT_SET_INVALID',
          message: 'La distance réelle est requise.',
        };
      }
      break;
    default:
      return {
        ok: false,
        code: 'WORKOUT_SET_INVALID',
        message: 'Type de mesure inconnu.',
      };
  }

  return { ok: true, normalized: input };
}

const workoutClientCommandIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Identifiant de commande invalide.')
  .optional();

const expectedVersionSchema = z.number().int().min(1).max(1_000_000_000);

export const pauseWorkoutSessionSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    clientCommandId: workoutClientCommandIdSchema,
  })
  .strict();

export const resumeWorkoutSessionSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    clientCommandId: workoutClientCommandIdSchema,
  })
  .strict();

export const completeWorkoutSessionSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    clientCommandId: workoutClientCommandIdSchema,
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const cancelWorkoutSessionSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    clientCommandId: workoutClientCommandIdSchema,
    keepRecordedData: z.literal(true),
    reason: z.string().max(500).nullable(),
  })
  .strict();

export type PauseWorkoutSessionInput = z.infer<typeof pauseWorkoutSessionSchema>;
export type ResumeWorkoutSessionInput = z.infer<
  typeof resumeWorkoutSessionSchema
>;
export type CompleteWorkoutSessionInput = z.infer<
  typeof completeWorkoutSessionSchema
>;
export type CancelWorkoutSessionInput = z.infer<
  typeof cancelWorkoutSessionSchema
>;

export type WorkoutLifecycleAction =
  | 'PAUSE'
  | 'RESUME'
  | 'COMPLETE'
  | 'CANCEL';

export type WorkoutLifecycleStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkoutLifecycleTransitionResult =
  | {
      ok: true;
      kind: 'apply' | 'noop';
      nextStatus: Exclude<
        WorkoutLifecycleStatus,
        'PLANNED'
      >;
    }
  | {
      ok: false;
      code: 'WORKOUT_INVALID_STATUS_TRANSITION';
      message: string;
    };

/**
 * Machine à états des transitions de cycle de vie d’une séance individuelle.
 * Les commandes déjà appliquées (cible déjà atteinte) sont idempotentes (`noop`).
 */
export function resolveWorkoutLifecycleTransition(
  currentStatus: WorkoutLifecycleStatus,
  action: WorkoutLifecycleAction,
): WorkoutLifecycleTransitionResult {
  if (action === 'PAUSE') {
    if (currentStatus === 'ACTIVE') {
      return { ok: true, kind: 'apply', nextStatus: 'PAUSED' };
    }
    if (currentStatus === 'PAUSED') {
      return { ok: true, kind: 'noop', nextStatus: 'PAUSED' };
    }
    return {
      ok: false,
      code: 'WORKOUT_INVALID_STATUS_TRANSITION',
      message: 'Seule une séance active peut être mise en pause.',
    };
  }

  if (action === 'RESUME') {
    if (currentStatus === 'PAUSED') {
      return { ok: true, kind: 'apply', nextStatus: 'ACTIVE' };
    }
    if (currentStatus === 'ACTIVE') {
      return { ok: true, kind: 'noop', nextStatus: 'ACTIVE' };
    }
    return {
      ok: false,
      code: 'WORKOUT_INVALID_STATUS_TRANSITION',
      message: 'Seule une séance en pause peut être reprise.',
    };
  }

  if (action === 'COMPLETE') {
    if (currentStatus === 'ACTIVE' || currentStatus === 'PAUSED') {
      return { ok: true, kind: 'apply', nextStatus: 'COMPLETED' };
    }
    if (currentStatus === 'COMPLETED') {
      return { ok: true, kind: 'noop', nextStatus: 'COMPLETED' };
    }
    return {
      ok: false,
      code: 'WORKOUT_INVALID_STATUS_TRANSITION',
      message: 'Cette séance ne peut plus être terminée.',
    };
  }

  if (currentStatus === 'ACTIVE' || currentStatus === 'PAUSED') {
    return { ok: true, kind: 'apply', nextStatus: 'CANCELLED' };
  }
  if (currentStatus === 'CANCELLED') {
    return { ok: true, kind: 'noop', nextStatus: 'CANCELLED' };
  }
  return {
    ok: false,
    code: 'WORKOUT_INVALID_STATUS_TRANSITION',
    message: 'Cette séance ne peut plus être annulée.',
  };
}

export function buildWorkoutLifecycleFingerprint(
  action: WorkoutLifecycleAction,
  payload: Record<string, unknown>,
): string {
  const normalized: Record<string, unknown> = { action };
  for (const key of Object.keys(payload).sort()) {
    if (key === 'clientCommandId' || key === 'expectedVersion') {
      continue;
    }
    const value = payload[key];
    if (value === undefined) {
      continue;
    }
    normalized[key] = value;
  }
  return JSON.stringify(normalized);
}

export function buildWorkoutSetCommandFingerprint(payload: {
  status: string;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  notes: string | null;
}): string {
  return JSON.stringify({
    status: payload.status,
    actualWeightKg: payload.actualWeightKg,
    actualReps: payload.actualReps,
    actualDurationSeconds: payload.actualDurationSeconds,
    actualDistanceMeters: payload.actualDistanceMeters,
    actualRir: payload.actualRir,
    actualRpe: payload.actualRpe,
    reachedFailure: payload.reachedFailure,
    notes: payload.notes,
  });
}

export function normalizeOptionalPlainText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Statuts autorisés sur l’historique (pas ACTIVE / PAUSED / PLANNED). */
export const workoutHistoryStatusSchema = z.enum(['COMPLETED', 'CANCELLED']);

export type WorkoutHistoryStatusFilter = z.infer<
  typeof workoutHistoryStatusSchema
>;

export const listWorkoutHistoryLimitSchema = listProgramsLimitSchema;

/**
 * Query `GET /api/v1/workouts` — historique des séances terminées / annulées.
 * Les paramètres inconnus sont ignorés (convention liste programmes / exercices).
 */
export const workoutHistoryQuerySchema = z
  .object({
    status: z.preprocess(
      emptyQueryToUndefined,
      workoutHistoryStatusSchema.optional(),
    ),
    from: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    to: z.preprocess(emptyQueryToUndefined, localDateSchema.optional()),
    programId: z.preprocess(
      emptyQueryToUndefined,
      z.string().uuid().optional(),
    ),
    workoutTemplateId: z.preprocess(
      emptyQueryToUndefined,
      z.string().uuid().optional(),
    ),
    cursor: z.preprocess(emptyQueryToUndefined, z.string().min(1).optional()),
    limit: listWorkoutHistoryLimitSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WORKOUT_HISTORY_INVALID_DATE_RANGE',
        path: ['to'],
      });
    }
  });

export type WorkoutHistoryQuery = z.infer<typeof workoutHistoryQuerySchema>;

export type WorkoutHistoryQueryParseErrorCode =
  | 'WORKOUT_HISTORY_INVALID_STATUS'
  | 'WORKOUT_HISTORY_INVALID_FROM_DATE'
  | 'WORKOUT_HISTORY_INVALID_TO_DATE'
  | 'WORKOUT_HISTORY_INVALID_DATE_RANGE'
  | 'WORKOUT_HISTORY_INVALID_QUERY';

export type WorkoutHistoryQueryParseResult =
  | { ok: true; data: WorkoutHistoryQuery }
  | { ok: false; code: WorkoutHistoryQueryParseErrorCode; message: string };

function workoutHistoryQueryErrorMessage(
  code: WorkoutHistoryQueryParseErrorCode,
): string {
  switch (code) {
    case 'WORKOUT_HISTORY_INVALID_STATUS':
      return 'Statut d’historique invalide.';
    case 'WORKOUT_HISTORY_INVALID_FROM_DATE':
      return 'Date de début invalide.';
    case 'WORKOUT_HISTORY_INVALID_TO_DATE':
      return 'Date de fin invalide.';
    case 'WORKOUT_HISTORY_INVALID_DATE_RANGE':
      return 'La date de début doit être antérieure ou égale à la date de fin.';
    case 'WORKOUT_HISTORY_INVALID_QUERY':
      return 'Paramètres de liste invalides.';
  }
}

/** Parse la query historique avec codes d’erreur métier stables. */
export function parseWorkoutHistoryQuery(
  raw: unknown,
): WorkoutHistoryQueryParseResult {
  const result = workoutHistoryQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  for (const issue of result.error.issues) {
    const path = issue.path[0];
    if (issue.message === 'WORKOUT_HISTORY_INVALID_DATE_RANGE') {
      return {
        ok: false,
        code: 'WORKOUT_HISTORY_INVALID_DATE_RANGE',
        message: workoutHistoryQueryErrorMessage(
          'WORKOUT_HISTORY_INVALID_DATE_RANGE',
        ),
      };
    }
    if (path === 'status') {
      return {
        ok: false,
        code: 'WORKOUT_HISTORY_INVALID_STATUS',
        message: workoutHistoryQueryErrorMessage(
          'WORKOUT_HISTORY_INVALID_STATUS',
        ),
      };
    }
    if (path === 'from') {
      return {
        ok: false,
        code: 'WORKOUT_HISTORY_INVALID_FROM_DATE',
        message: workoutHistoryQueryErrorMessage(
          'WORKOUT_HISTORY_INVALID_FROM_DATE',
        ),
      };
    }
    if (path === 'to') {
      return {
        ok: false,
        code: 'WORKOUT_HISTORY_INVALID_TO_DATE',
        message: workoutHistoryQueryErrorMessage(
          'WORKOUT_HISTORY_INVALID_TO_DATE',
        ),
      };
    }
  }

  return {
    ok: false,
    code: 'WORKOUT_HISTORY_INVALID_QUERY',
    message: workoutHistoryQueryErrorMessage('WORKOUT_HISTORY_INVALID_QUERY'),
  };
}

export type WorkoutHistoryCursorPayload = {
  version: 1;
  localDate: string;
  startedAt: string;
  id: string;
};

export function encodeWorkoutHistoryCursor(
  payload: WorkoutHistoryCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeWorkoutHistoryCursor(
  cursor: string,
): WorkoutHistoryCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('WORKOUT_HISTORY_INVALID_CURSOR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { localDate?: unknown }).localDate !== 'string' ||
    typeof (parsed as { startedAt?: unknown }).startedAt !== 'string' ||
    typeof (parsed as { id?: unknown }).id !== 'string' ||
    !isValidLocalDateString((parsed as { localDate: string }).localDate) ||
    (parsed as { startedAt: string }).startedAt.length === 0 ||
    (parsed as { id: string }).id.length === 0 ||
    Number.isNaN(Date.parse((parsed as { startedAt: string }).startedAt))
  ) {
    throw new Error('WORKOUT_HISTORY_INVALID_CURSOR');
  }

  return {
    version: 1,
    localDate: (parsed as { localDate: string }).localDate,
    startedAt: (parsed as { startedAt: string }).startedAt,
    id: (parsed as { id: string }).id,
  };
}

/**
 * Filtre cursor pour tri `localDate DESC, startedAt DESC, id DESC`.
 */
export function buildWorkoutHistoryCursorFilter(
  cursor: WorkoutHistoryCursorPayload,
): {
  OR: Array<
    | { localDate: { lt: Date } }
    | {
        AND: [
          { localDate: Date },
          { startedAt: { lt: Date } },
        ];
      }
    | {
        AND: [
          { localDate: Date },
          { startedAt: Date },
          { id: { lt: string } },
        ];
      }
  >;
} {
  const localDate = localDateStringToUtcDate(cursor.localDate);
  const startedAt = new Date(cursor.startedAt);
  return {
    OR: [
      { localDate: { lt: localDate } },
      {
        AND: [{ localDate }, { startedAt: { lt: startedAt } }],
      },
      {
        AND: [{ localDate }, { startedAt }, { id: { lt: cursor.id } }],
      },
    ],
  };
}

export {
  comparePersonalRecordPrimary,
  comparePersonalRecordTieBreak,
  comparePersonalRecordsSort,
  decodePersonalRecordsCursor,
  encodePersonalRecordsCursor,
  getPersonalRecordPrincipalValue,
  isBetterPersonalRecordCandidate,
  isPersonalRecordAfterCursor,
  isSetEligibleForPersonalRecord,
  listPersonalRecordsLimitSchema,
  parsePersonalRecordsQuery,
  personalRecordGroupKey,
  personalRecordTypeSchema,
  personalRecordsQuerySchema,
  resolveRecordTypesForMeasurement,
  selectCurrentPersonalRecords,
  selectCurrentPersonalRecordsWithType,
} from './personal-records';
export type {
  ExerciseMeasurementTypeForRecords,
  PersonalRecordCandidate,
  PersonalRecordEligibilityInput,
  PersonalRecordSetValues,
  PersonalRecordType,
  PersonalRecordsCursorPayload,
  PersonalRecordsQuery,
  PersonalRecordsQueryParseErrorCode,
  PersonalRecordsQueryParseResult,
  PersonalRecordsSortKey,
  WorkoutSetTypeForRecords,
} from './personal-records';

export {
  addExternalVolumeKg,
  computeElapsedDurationSeconds,
  computeWorkoutMetrics,
  contributesToExternalVolume,
  contributesToTotalReps,
  isPerformedSetStatus,
  isProcessedSetStatus,
  resolveOfficialWorkoutMetrics,
  setExternalVolumeContributionKg,
} from './workout-metrics';
export type {
  WorkoutMetricsExerciseInput,
  WorkoutMetricsSessionInput,
  WorkoutMetricsSetInput,
} from './workout-metrics';

export {
  EXERCISE_PROGRESS_MAX_POINTS,
  addLocalDateDays,
  addLocalDateMonths,
  compareExerciseProgressPointsAsc,
  computeExerciseProgressSummary,
  computeExerciseWorkoutProgressPoint,
  excludesWarmupFromProgressMetric,
  exerciseProgressMetricSchema,
  exerciseProgressQuerySchema,
  isProgressMetricCompatibleWithMeasurement,
  parseExerciseProgressQuery,
  resolveAvailableProgressMetrics,
  resolveAvailableProgressMetricsFromTypes,
  resolveDefaultProgressMetric,
} from './exercise-progress';
export type {
  ExerciseMeasurementTypeForProgress,
  ExerciseProgressMetric,
  ExerciseProgressOccurrenceInput,
  ExerciseProgressPointComputed,
  ExerciseProgressPointContext,
  ExerciseProgressQuery,
  ExerciseProgressQueryParseErrorCode,
  ExerciseProgressQueryParseResult,
  ExerciseProgressSessionInput,
  ExerciseProgressSetInput,
  ExerciseProgressSummaryComputed,
} from './exercise-progress';

export {
  PROGRESS_OVERVIEW_DAY_BUCKET_MAX_DAYS,
  PROGRESS_OVERVIEW_RECENT_RECORDS_LIMIT,
  PROGRESS_OVERVIEW_TOP_EXERCISES_LIMIT,
  PROGRESS_OVERVIEW_WEEK_BUCKET_MAX_DAYS,
  bucketBoundsForDate,
  buildProgressOverviewTimeline,
  computeAverageWorkoutsPerWeek,
  computeProgressOverviewComparison,
  computeProgressOverviewTotals,
  computeProgressTopExercises,
  countInclusiveLocalDays,
  emptyProgressOverviewTotals,
  endOfMonth,
  endOfWeekSunday,
  nextBucketStart,
  parseProgressOverviewQuery,
  percentageChange,
  pointValueForMetric,
  progressOverviewBucketSchema,
  progressOverviewMetricSchema,
  progressOverviewQuerySchema,
  resolveAvailableOverviewMetrics,
  resolveDefaultOverviewMetric,
  resolvePreviousRange,
  resolveProgressOverviewBucket,
  startOfMonth,
  startOfWeekMonday,
} from './progress-overview';
export type {
  ProgressOverviewBucket,
  ProgressOverviewComparisonComputed,
  ProgressOverviewMetric,
  ProgressOverviewPointComputed,
  ProgressOverviewQuery,
  ProgressOverviewQueryParseErrorCode,
  ProgressOverviewQueryParseResult,
  ProgressOverviewSessionInput,
  ProgressOverviewTotalsComputed,
  ProgressTopExerciseComputed,
} from './progress-overview';

export {
  MAX_E1RM_REPS,
  MIN_E1RM_REPS,
  ONE_REP_MAX_FORMULA,
  collectEstimatedOneRepMaxCandidates,
  compareEstimatedOneRepMaxCandidates,
  compareStrengthPointsAsc,
  computeBestEstimatedOneRepMaxForWorkout,
  computeExerciseStrengthSummary,
  estimateOneRepMaxEpley,
  exerciseStrengthQuerySchema,
  isEligibleForEstimatedOneRepMax,
  isStrengthSupportedForMeasurement,
  parseExerciseStrengthQuery,
} from './one-rep-max';
export type {
  EstimatedOneRepMaxCandidate,
  EstimatedOneRepMaxEligibilityInput,
  EstimatedStrengthPointComputed,
  EstimatedStrengthSource,
  ExerciseStrengthQuery,
  ExerciseStrengthQueryParseErrorCode,
  ExerciseStrengthQueryParseResult,
  ExerciseStrengthSummaryComputed,
  OneRepMaxFormula,
  StrengthOccurrenceInput,
  StrengthSessionInput,
  StrengthSetInput,
} from './one-rep-max';

export {
  DEFAULT_LOAD_INCREMENT_KG,
  LOAD_RECOMMENDATION_HISTORY_LIMIT,
  LOAD_RECOMMENDATION_RIR_TOLERANCE,
  LOAD_RECOMMENDATION_RPE_TOLERANCE,
  assessEffortAgainstTarget,
  assessSetAgainstTarget,
  assessWorkoutPerformance,
  computeSuggestedWeightKg,
  resolveLoadIncrement,
  resolveLoadRecommendation,
  resolveLoadTargetFromTemplateSets,
  roundToLoadIncrement,
} from './load-recommendation';
export type {
  EffortAssessment,
  EffortTrackingModeForLoad,
  HistoricalWorkoutInput,
  LoadIncrementSource,
  LoadRecommendationAction,
  LoadRecommendationEvidenceWorkout,
  LoadRecommendationReason,
  LoadRecommendationResult,
  LoadRecommendationSuggestion,
  PerformedSetInput,
  ResolveLoadRecommendationInput,
  ResolveLoadTargetResult,
  ResolvedLoadTarget,
  SetTargetAssessment,
  TemplateSetTargetInput,
  WorkoutPerformanceAssessment,
  WorkoutSetStatusForLoad,
  WorkoutSetTypeForLoad,
  WorkoutUnderperformanceKind,
} from './load-recommendation';
