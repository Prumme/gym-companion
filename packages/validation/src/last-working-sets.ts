import { z } from 'zod';

export const LAST_WORKING_SETS_MAX_EXERCISE_IDS = 40;

function emptyQueryToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

function splitExerciseIds(value: unknown): unknown {
  const normalized = emptyQueryToUndefined(value);
  if (normalized === undefined) {
    return undefined;
  }
  if (Array.isArray(normalized)) {
    return normalized.flatMap((item) =>
      typeof item === 'string' ? item.split(',') : [item],
    );
  }
  if (typeof normalized === 'string') {
    return normalized.split(',');
  }
  return normalized;
}

export const lastWorkingSetsQuerySchema = z
  .object({
    exerciseIds: z.preprocess(
      splitExerciseIds,
      z
        .array(z.string().trim())
        .min(1, 'Au moins un exercice est requis.')
        .max(
          LAST_WORKING_SETS_MAX_EXERCISE_IDS,
          `Au plus ${LAST_WORKING_SETS_MAX_EXERCISE_IDS} exercices.`,
        )
        .transform((ids) => {
          const unique: string[] = [];
          const seen = new Set<string>();
          for (const id of ids) {
            const trimmed = id.trim();
            if (!trimmed || seen.has(trimmed)) continue;
            seen.add(trimmed);
            unique.push(trimmed);
          }
          return unique;
        })
        .pipe(
          z
            .array(z.string().uuid('Identifiant d’exercice invalide.'))
            .min(1)
            .max(LAST_WORKING_SETS_MAX_EXERCISE_IDS),
        ),
    ),
  })
  .strict();

export type LastWorkingSetsQuery = z.infer<typeof lastWorkingSetsQuerySchema>;

export type LastWorkingSetsQueryParseErrorCode =
  | 'PROGRESS_INVALID_QUERY'
  | 'PROGRESS_INVALID_EXERCISE_IDS';

export type LastWorkingSetsQueryParseResult =
  | { ok: true; data: LastWorkingSetsQuery }
  | {
      ok: false;
      code: LastWorkingSetsQueryParseErrorCode;
      message: string;
    };

export function parseLastWorkingSetsQuery(
  raw: unknown,
): LastWorkingSetsQueryParseResult {
  const result = lastWorkingSetsQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  for (const issue of result.error.issues) {
    if (issue.path[0] === 'exerciseIds') {
      return {
        ok: false,
        code: 'PROGRESS_INVALID_EXERCISE_IDS',
        message: 'Liste d’exercices invalide.',
      };
    }
  }

  return {
    ok: false,
    code: 'PROGRESS_INVALID_QUERY',
    message: 'Paramètres de progression invalides.',
  };
}
