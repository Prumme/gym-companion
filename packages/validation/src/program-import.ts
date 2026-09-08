/**
 * Contrat d’import de programme V1 (AI Program Import Bridge).
 *
 * JSON externe ≠ Prisma. Entrée hostile : schemas `.strict()`, pas d’IDs internes.
 * Gym Companion ne contacte aucune IA.
 */

import { z } from 'zod';

export const PROGRAM_IMPORT_SCHEMA_VERSION = 1 as const;

export const PROGRAM_IMPORT_MAX_PAYLOAD_BYTES = 64 * 1024;
export const PROGRAM_IMPORT_MAX_WORKOUTS = 7;
export const PROGRAM_IMPORT_MAX_EXERCISES_PER_WORKOUT = 12;
export const PROGRAM_IMPORT_MAX_SETS_PER_EXERCISE = 10;
export const PROGRAM_IMPORT_MAX_NAME = 120;
export const PROGRAM_IMPORT_MAX_TEXT = 2000;
export const PROGRAM_IMPORT_SLUG_MAX = 80;

export const PROGRAM_IMPORT_GOALS = [
  'ENDURANCE',
  'HYPERTROPHY',
  'STRENGTH',
  'GENERAL_FITNESS',
] as const;

export const programImportGoalSchema = z.enum(PROGRAM_IMPORT_GOALS);

export const programImportExerciseSlugSchema = z
  .string()
  .trim()
  .min(1, 'Champ obligatoire.')
  .max(PROGRAM_IMPORT_SLUG_MAX)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'exerciseSlug invalide. Utilise uniquement des slugs kebab-case du catalogue.',
  );

const optionalFiniteNumber = (schema: z.ZodNumber) => schema.finite().nullish();

export const programImportSetV1Schema = z
  .object({
    repsMin: optionalFiniteNumber(z.number().int().min(1).max(500)),
    repsMax: optionalFiniteNumber(z.number().int().min(1).max(500)),
    durationSeconds: optionalFiniteNumber(z.number().int().min(1).max(86_400)),
    distanceMeters: optionalFiniteNumber(z.number().positive().max(1_000_000)),
    weightKg: optionalFiniteNumber(z.number().min(0).max(10_000)),
    rir: optionalFiniteNumber(z.number().int().min(0).max(10)),
    rpe: optionalFiniteNumber(z.number().min(1).max(10)),
    restSeconds: optionalFiniteNumber(z.number().int().min(0).max(1800)),
  })
  .strict();

export type ProgramImportSetV1 = z.infer<typeof programImportSetV1Schema>;

export const programImportExerciseV1Schema = z
  .object({
    exerciseSlug: programImportExerciseSlugSchema,
    notes: z.string().max(PROGRAM_IMPORT_MAX_TEXT).nullable().optional(),
    sets: z
      .array(programImportSetV1Schema)
      .min(1, 'Au moins une série est requise.')
      .max(
        PROGRAM_IMPORT_MAX_SETS_PER_EXERCISE,
        `Maximum ${PROGRAM_IMPORT_MAX_SETS_PER_EXERCISE} séries par exercice.`,
      ),
  })
  .strict();

export type ProgramImportExerciseV1 = z.infer<
  typeof programImportExerciseV1Schema
>;

export const programImportWorkoutV1Schema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(PROGRAM_IMPORT_MAX_NAME),
    description: z.string().max(PROGRAM_IMPORT_MAX_TEXT).nullable().optional(),
    estimatedDurationMinutes: z.number().int().min(1).max(600),
    exercises: z
      .array(programImportExerciseV1Schema)
      .min(1, 'Au moins un exercice est requis.')
      .max(
        PROGRAM_IMPORT_MAX_EXERCISES_PER_WORKOUT,
        `Maximum ${PROGRAM_IMPORT_MAX_EXERCISES_PER_WORKOUT} exercices par séance.`,
      ),
  })
  .strict();

export type ProgramImportWorkoutV1 = z.infer<
  typeof programImportWorkoutV1Schema
>;

export const programImportProgramV1Schema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(PROGRAM_IMPORT_MAX_NAME),
    description: z.string().max(PROGRAM_IMPORT_MAX_TEXT).nullable().optional(),
    goal: programImportGoalSchema,
    workouts: z
      .array(programImportWorkoutV1Schema)
      .min(1, 'Au moins une séance est requise.')
      .max(
        PROGRAM_IMPORT_MAX_WORKOUTS,
        `Maximum ${PROGRAM_IMPORT_MAX_WORKOUTS} séances.`,
      ),
  })
  .strict();

export type ProgramImportProgramV1 = z.infer<
  typeof programImportProgramV1Schema
>;

export const programImportPayloadV1Schema = z
  .object({
    schemaVersion: z.literal(PROGRAM_IMPORT_SCHEMA_VERSION),
    program: programImportProgramV1Schema,
  })
  .strict();

export type ProgramImportPayloadV1 = z.infer<
  typeof programImportPayloadV1Schema
>;

export const PROGRAM_IMPORT_ERROR_CODES = [
  'JSON_SYNTAX',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_SCHEMA_VERSION',
  'UNKNOWN_FIELD',
  'REQUIRED',
  'INVALID_TYPE',
  'INVALID_ENUM',
  'LIMIT_EXCEEDED',
  'UNKNOWN_EXERCISE',
  'EXERCISE_ARCHIVED',
  'DUPLICATE_EXERCISE_IN_WORKOUT',
  'INCOMPATIBLE_MEASUREMENT',
  'INVALID_TARGETS',
  'CONFLICTING_INTENSITY',
] as const;

export type ProgramImportErrorCode = (typeof PROGRAM_IMPORT_ERROR_CODES)[number];

export type ProgramImportIssue = {
  path: string;
  code: ProgramImportErrorCode;
  message: string;
  suggestions?: string[];
};

export type ProgramImportExerciseCatalogEntry = {
  slug: string;
  name: string;
  primaryMuscleCode: string;
  defaultEquipmentCode: string;
  measurementType:
    | 'WEIGHT_REPS'
    | 'BODYWEIGHT_REPS'
    | 'ASSISTED_BODYWEIGHT_REPS'
    | 'REPS_ONLY'
    | 'DURATION'
    | 'DISTANCE_DURATION'
    | 'WEIGHT_DURATION';
};

export type ProgramImportSetTargetFields = {
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

export function measureJsonPayloadBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function formatSystemExerciseCatalogLine(
  item: ProgramImportExerciseCatalogEntry,
): string {
  return `${item.slug} | ${item.name} | ${item.primaryMuscleCode} | ${item.defaultEquipmentCode} | ${item.measurementType}`;
}

export function programImportSetToTargetFields(
  set: ProgramImportSetV1,
): ProgramImportSetTargetFields {
  return {
    targetRepMin: set.repsMin ?? null,
    targetRepMax: set.repsMax ?? null,
    targetDurationSeconds: set.durationSeconds ?? null,
    targetDistanceMeters: set.distanceMeters ?? null,
    targetWeightKg: set.weightKg ?? null,
    targetIntensityPercent: null,
    targetRir: set.rir ?? null,
    targetRpe: set.rpe ?? null,
    restSeconds: set.restSeconds ?? null,
  };
}

function zodPathToString(path: ReadonlyArray<string | number>): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') {
      return `${acc}[${key}]`;
    }
    return acc.length === 0 ? key : `${acc}.${key}`;
  }, '');
}

function mapZodIssue(issue: z.ZodIssue): ProgramImportIssue {
  const path = zodPathToString(issue.path);

  if (issue.code === z.ZodIssueCode.unrecognized_keys) {
    const keys = issue.keys;
    const first = keys[0] ?? 'unknown';
    const fieldPath = path.length > 0 ? `${path}.${first}` : first;
    return {
      path: fieldPath,
      code: 'UNKNOWN_FIELD',
      message: `Propriété inconnue : ${keys.join(', ')}.`,
    };
  }

  if (issue.code === z.ZodIssueCode.invalid_literal) {
    if (issue.path.length === 1 && issue.path[0] === 'schemaVersion') {
      return {
        path: 'schemaVersion',
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Version d'import non supportée : ${String(issue.received)}. Version supportée : 1.`,
      };
    }
    return {
      path,
      code: 'INVALID_TYPE',
      message: issue.message,
    };
  }

  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return {
      path,
      code: 'INVALID_ENUM',
      message: `Valeur non autorisée : ${String(issue.received)}. Valeurs autorisées : ${issue.options.join(', ')}.`,
    };
  }

  if (
    issue.code === z.ZodIssueCode.too_small ||
    issue.code === z.ZodIssueCode.too_big
  ) {
    if (issue.code === z.ZodIssueCode.too_small && issue.type === 'string') {
      return {
        path,
        code: 'REQUIRED',
        message: issue.message || 'Champ obligatoire.',
      };
    }
    return {
      path,
      code: 'LIMIT_EXCEEDED',
      message: issue.message,
    };
  }

  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.received === 'undefined') {
      return {
        path,
        code: 'REQUIRED',
        message: 'Champ obligatoire.',
      };
    }
    return {
      path,
      code: 'INVALID_TYPE',
      message: issue.message,
    };
  }

  return {
    path,
    code: 'INVALID_TYPE',
    message: issue.message,
  };
}

function readSchemaVersion(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  return (raw as { schemaVersion?: unknown }).schemaVersion;
}

export type ProgramImportParseResult =
  | { ok: true; data: ProgramImportPayloadV1 }
  | { ok: false; errors: ProgramImportIssue[] };

export function parseProgramImportPayload(
  raw: unknown,
): ProgramImportParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [
        {
          path: '',
          code: 'INVALID_TYPE',
          message: 'Le payload doit être un objet JSON.',
        },
      ],
    };
  }

  const version = readSchemaVersion(raw);
  if (version === undefined) {
    return {
      ok: false,
      errors: [
        {
          path: 'schemaVersion',
          code: 'REQUIRED',
          message: 'Champ obligatoire.',
        },
      ],
    };
  }
  if (version !== PROGRAM_IMPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: 'schemaVersion',
          code: 'UNSUPPORTED_SCHEMA_VERSION',
          message: `Version d'import non supportée : ${String(version)}. Version supportée : 1.`,
        },
      ],
    };
  }

  const parsed = programImportPayloadV1Schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map(mapZodIssue),
  };
}

export function findDuplicateExerciseSlugsInWorkout(
  workoutPath: string,
  exercises: ProgramImportExerciseV1[],
): ProgramImportIssue[] {
  const seen = new Map<string, number>();
  const errors: ProgramImportIssue[] = [];
  for (let index = 0; index < exercises.length; index += 1) {
    const slug = exercises[index]!.exerciseSlug;
    const previous = seen.get(slug);
    if (previous !== undefined) {
      errors.push({
        path: `${workoutPath}.exercises[${index}].exerciseSlug`,
        code: 'DUPLICATE_EXERCISE_IN_WORKOUT',
        message: `L’exercice « ${slug} » est déjà présent dans cette séance (exercice ${previous + 1}). Un même exercice ne peut apparaître qu’une fois par séance.`,
      });
    } else {
      seen.set(slug, index);
    }
  }
  return errors;
}

const WEIGHT_ALLOWED_TYPES = new Set([
  'WEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'WEIGHT_DURATION',
]);

export function validateProgramImportSetForMeasurement(
  measurementType: ProgramImportExerciseCatalogEntry['measurementType'],
  set: ProgramImportSetV1,
  setPath: string,
): ProgramImportIssue[] {
  const errors: ProgramImportIssue[] = [];
  const repsMin = set.repsMin ?? null;
  const repsMax = set.repsMax ?? null;
  const durationSeconds = set.durationSeconds ?? null;
  const distanceMeters = set.distanceMeters ?? null;
  const weightKg = set.weightKg ?? null;
  const rir = set.rir ?? null;
  const rpe = set.rpe ?? null;

  if (rir != null && rpe != null) {
    errors.push({
      path: `${setPath}.rir`,
      code: 'CONFLICTING_INTENSITY',
      message: 'Une série ne peut pas définir RIR et RPE simultanément.',
    });
  }

  if ((repsMin == null) !== (repsMax == null)) {
    errors.push({
      path: `${setPath}.${repsMin == null ? 'repsMin' : 'repsMax'}`,
      code: 'INVALID_TARGETS',
      message: 'repsMin et repsMax doivent être fournis ensemble.',
    });
  } else if (repsMin != null && repsMax != null && repsMin > repsMax) {
    errors.push({
      path: `${setPath}.repsMin`,
      code: 'INVALID_TARGETS',
      message: `${repsMin} ne peut pas être supérieur à repsMax ${repsMax}.`,
    });
  }

  const hasReps = repsMin != null && repsMax != null;
  const hasDuration = durationSeconds != null;
  const hasDistance = distanceMeters != null;

  switch (measurementType) {
    case 'WEIGHT_REPS':
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      if (hasDuration) {
        errors.push({
          path: `${setPath}.durationSeconds`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `durationSeconds n'est pas compatible avec un exercice ${measurementType}.`,
        });
      }
      if (hasDistance) {
        errors.push({
          path: `${setPath}.distanceMeters`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `distanceMeters n'est pas compatible avec un exercice ${measurementType}.`,
        });
      }
      if (!hasReps) {
        errors.push({
          path: `${setPath}.repsMin`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `Une cible de répétitions est requise pour un exercice ${measurementType}.`,
        });
      }
      break;
    case 'DURATION':
    case 'WEIGHT_DURATION':
      if (hasReps) {
        errors.push({
          path: `${setPath}.repsMin`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `repsMin n'est pas compatible avec un exercice ${measurementType}.`,
        });
      }
      if (hasDistance) {
        errors.push({
          path: `${setPath}.distanceMeters`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `distanceMeters n'est pas compatible avec un exercice ${measurementType}.`,
        });
      }
      if (!hasDuration) {
        errors.push({
          path: `${setPath}.durationSeconds`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `Une durée cible est requise pour un exercice ${measurementType}.`,
        });
      }
      break;
    case 'DISTANCE_DURATION':
      if (hasReps) {
        errors.push({
          path: `${setPath}.repsMin`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `repsMin n'est pas compatible avec un exercice ${measurementType}.`,
        });
      }
      if (!hasDistance) {
        errors.push({
          path: `${setPath}.distanceMeters`,
          code: 'INCOMPATIBLE_MEASUREMENT',
          message: `Une distance cible est requise pour un exercice ${measurementType}.`,
        });
      }
      break;
    default:
      errors.push({
        path: setPath,
        code: 'INCOMPATIBLE_MEASUREMENT',
        message: 'Type de mesure non supporté.',
      });
  }

  if (weightKg != null && !WEIGHT_ALLOWED_TYPES.has(measurementType)) {
    errors.push({
      path: `${setPath}.weightKg`,
      code: 'INCOMPATIBLE_MEASUREMENT',
      message: `weightKg n'est pas compatible avec un exercice ${measurementType}.`,
    });
  }

  return errors;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j += 1) {
    dp[0]![j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[a.length]![b.length]!;
}

export function suggestExerciseSlugs(
  unknownSlug: string,
  catalogSlugs: readonly string[],
  max = 3,
): string[] {
  const needle = unknownSlug.trim().toLowerCase();
  if (needle.length === 0) {
    return [];
  }
  const scored = catalogSlugs
    .filter((slug) => slug !== needle)
    .map((slug) => {
      const distance = levenshtein(needle, slug);
      const prefixBonus =
        slug.startsWith(needle) || needle.startsWith(slug) ? -1 : 0;
      const containsBonus =
        slug.includes(needle) || needle.includes(slug) ? -1 : 0;
      return { slug, score: distance + prefixBonus + containsBonus, distance };
    })
    .filter((item) => item.distance <= 6)
    .sort((a, b) => a.score - b.score || a.slug.localeCompare(b.slug));

  const unique: string[] = [];
  for (const item of scored) {
    if (!unique.includes(item.slug)) {
      unique.push(item.slug);
    }
    if (unique.length >= max) {
      break;
    }
  }
  return unique;
}

export const PROGRAM_IMPORT_V1_CONTRACT_TEXT = `schemaVersion: 1 (required, integer literal 1)

Root object (no extra keys):
{
  "schemaVersion": 1,
  "program": {
    "name": string (1-120),
    "description": string | null (max 2000),
    "goal": "ENDURANCE" | "HYPERTROPHY" | "STRENGTH" | "GENERAL_FITNESS",
    "workouts": [Workout, ... 1 to 7]
  }
}

Workout:
{
  "name": string (1-120),
  "description": string | null,
  "estimatedDurationMinutes": integer 1-600,
  "exercises": [Exercise, ... 1 to 12]
}

Exercise:
{
  "exerciseSlug": kebab-case slug from AVAILABLE EXERCISES (never invent, never use UUID),
  "notes": string | null,
  "sets": [Set, ... 1 to 10]
}

Set (omit unused fields; do not include measurementType, setType, ids):
{
  "repsMin": integer 1-500,
  "repsMax": integer 1-500,
  "durationSeconds": integer 1-86400,
  "distanceMeters": number > 0,
  "weightKg": number >= 0,
  "rir": integer 0-10,
  "rpe": number 1-10,
  "restSeconds": integer 0-1800
}

Target rules (measurementType comes from the catalog, never from JSON):
- WEIGHT_REPS / BODYWEIGHT_REPS / ASSISTED_BODYWEIGHT_REPS / REPS_ONLY: repsMin+repsMax required; no durationSeconds; no distanceMeters.
- WEIGHT_REPS and ASSISTED_BODYWEIGHT_REPS: weightKg optional.
- BODYWEIGHT_REPS / REPS_ONLY: no weightKg.
- DURATION / WEIGHT_DURATION: durationSeconds required; no reps; no distanceMeters.
- DISTANCE_DURATION: distanceMeters required; durationSeconds optional; no reps.
- rir and rpe are mutually exclusive.
- Same exerciseSlug cannot appear twice in the same workout.
- setType is not allowed; Gym Companion defaults to WORKING.`;
