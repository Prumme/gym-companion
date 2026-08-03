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
