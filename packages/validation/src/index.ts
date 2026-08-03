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
 * Positions des modèles de séance : convention 0-based (0, 1, 2, …).
 */
export function computeNextWorkoutTemplatePosition(
  existingPositions: number[],
): number {
  if (existingPositions.length === 0) {
    return 0;
  }
  return Math.max(...existingPositions) + 1;
}

export function compactWorkoutTemplatePositions(
  orderedIds: string[],
): Array<{ id: string; position: number }> {
  return orderedIds.map((id, position) => ({ id, position }));
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
  if (new Set(requestedIds).size !== requestedIds.length) {
    return { ok: false, code: 'WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER' };
  }
  if (requestedIds.length !== existingIds.length) {
    return { ok: false, code: 'WORKOUT_TEMPLATE_ORDER_INCOMPLETE' };
  }
  const existing = new Set(existingIds);
  for (const id of requestedIds) {
    if (!existing.has(id)) {
      return { ok: false, code: 'WORKOUT_TEMPLATE_INVALID_ORDER' };
    }
  }
  return { ok: true };
}
