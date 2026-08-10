import { z } from 'zod';

/**
 * Records personnels simples (jalon 4.1).
 *
 * Calculés à la demande depuis les snapshots de séances COMPLETED /
 * séries COMPLETED (hors WARMUP). Pas de matérialisation en base.
 *
 * Limites documentées :
 * - ASSISTED_BODYWEIGHT_REPS : MAX_REPS uniquement (pas de règle d’assistance).
 * - sourceExerciseId = null : exclu des records par exercice (pas de rapprochement par nom).
 * - Pas de 1RM estimé, volume, graphiques, ni records de séance.
 */

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

export const personalRecordTypeSchema = z.enum([
  'MAX_WEIGHT',
  'MAX_REPS',
  'MAX_DURATION',
  'MAX_DISTANCE',
]);

export type PersonalRecordType = z.infer<typeof personalRecordTypeSchema>;

export type ExerciseMeasurementTypeForRecords =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'ASSISTED_BODYWEIGHT_REPS'
  | 'REPS_ONLY'
  | 'DURATION'
  | 'DISTANCE_DURATION'
  | 'WEIGHT_DURATION';

export type WorkoutSetTypeForRecords =
  | 'WARMUP'
  | 'WORKING'
  | 'BACKOFF'
  | 'DROP_SET'
  | 'AMRAP'
  | 'FAILURE_OPTIONAL';

/** Types de records disponibles pour un type de mesure snapshot. */
export function resolveRecordTypesForMeasurement(
  measurementType: ExerciseMeasurementTypeForRecords,
): PersonalRecordType[] {
  switch (measurementType) {
    case 'WEIGHT_REPS':
      return ['MAX_WEIGHT', 'MAX_REPS'];
    case 'BODYWEIGHT_REPS':
    case 'ASSISTED_BODYWEIGHT_REPS':
    case 'REPS_ONLY':
      return ['MAX_REPS'];
    case 'DURATION':
      return ['MAX_DURATION'];
    case 'DISTANCE_DURATION':
      return ['MAX_DISTANCE'];
    case 'WEIGHT_DURATION':
      return ['MAX_WEIGHT', 'MAX_DURATION'];
    default: {
      const _exhaustive: never = measurementType;
      return _exhaustive;
    }
  }
}

export type PersonalRecordEligibilityInput = {
  sessionStatus: string;
  setStatus: string;
  setType: string;
  sourceExerciseId: string | null;
};

/**
 * Éligibilité centralisée : séance COMPLETED, série COMPLETED,
 * hors WARMUP, sourceExerciseId non null.
 */
export function isSetEligibleForPersonalRecord(
  input: PersonalRecordEligibilityInput,
): boolean {
  if (input.sessionStatus !== 'COMPLETED') {
    return false;
  }
  if (input.setStatus !== 'COMPLETED') {
    return false;
  }
  if (input.setType === 'WARMUP') {
    return false;
  }
  if (input.sourceExerciseId == null) {
    return false;
  }
  return true;
}

export type PersonalRecordSetValues = {
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
};

/** Valeur principale d’un type de record ; null = absente / inutilisable. */
export function getPersonalRecordPrincipalValue(
  recordType: PersonalRecordType,
  values: PersonalRecordSetValues,
): number | null {
  switch (recordType) {
    case 'MAX_WEIGHT':
      return values.actualWeightKg;
    case 'MAX_REPS':
      return values.actualReps;
    case 'MAX_DURATION':
      return values.actualDurationSeconds;
    case 'MAX_DISTANCE':
      return values.actualDistanceMeters;
    default: {
      const _exhaustive: never = recordType;
      return _exhaustive;
    }
  }
}

export type PersonalRecordCandidate = PersonalRecordSetValues & {
  workoutSetId: string;
  workoutSessionExerciseId: string;
  workoutSessionId: string;
  sourceExerciseId: string;
  exerciseNameSnapshot: string;
  measurementTypeSnapshot: ExerciseMeasurementTypeForRecords;
  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  setType: WorkoutSetTypeForRecords;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  /** Date locale de la séance (YYYY-MM-DD). */
  achievedOn: string;
  /** Timestamp ISO de completedAt de la série, si disponible. */
  achievedAt: string | null;
};

export function personalRecordGroupKey(
  exerciseId: string,
  equipmentTypeId: string | null,
  recordType: PersonalRecordType,
): string {
  return `${exerciseId}\u0000${equipmentTypeId ?? ''}\u0000${recordType}`;
}

/**
 * Compare deux candidats pour un type de record.
 * Retourne > 0 si `a` est meilleur, < 0 si `b` est meilleur, 0 si égalité métier
 * (avant tie-break date / id).
 */
export function comparePersonalRecordPrimary(
  recordType: PersonalRecordType,
  a: PersonalRecordSetValues,
  b: PersonalRecordSetValues,
): number {
  switch (recordType) {
    case 'MAX_WEIGHT': {
      const aw = a.actualWeightKg ?? Number.NEGATIVE_INFINITY;
      const bw = b.actualWeightKg ?? Number.NEGATIVE_INFINITY;
      if (aw !== bw) {
        return aw > bw ? 1 : -1;
      }
      // Tie-break : reps (WEIGHT_REPS) ou durée (WEIGHT_DURATION).
      const aReps = a.actualReps;
      const bReps = b.actualReps;
      if (aReps != null || bReps != null) {
        const ar = aReps ?? Number.NEGATIVE_INFINITY;
        const br = bReps ?? Number.NEGATIVE_INFINITY;
        if (ar !== br) {
          return ar > br ? 1 : -1;
        }
      }
      const aDur = a.actualDurationSeconds;
      const bDur = b.actualDurationSeconds;
      if (aDur != null || bDur != null) {
        const ad = aDur ?? Number.NEGATIVE_INFINITY;
        const bd = bDur ?? Number.NEGATIVE_INFINITY;
        if (ad !== bd) {
          return ad > bd ? 1 : -1;
        }
      }
      return 0;
    }
    case 'MAX_REPS': {
      const ar = a.actualReps ?? Number.NEGATIVE_INFINITY;
      const br = b.actualReps ?? Number.NEGATIVE_INFINITY;
      if (ar !== br) {
        return ar > br ? 1 : -1;
      }
      const aw = a.actualWeightKg;
      const bw = b.actualWeightKg;
      if (aw != null || bw != null) {
        const aWeight = aw ?? Number.NEGATIVE_INFINITY;
        const bWeight = bw ?? Number.NEGATIVE_INFINITY;
        if (aWeight !== bWeight) {
          return aWeight > bWeight ? 1 : -1;
        }
      }
      return 0;
    }
    case 'MAX_DURATION': {
      const ad = a.actualDurationSeconds ?? Number.NEGATIVE_INFINITY;
      const bd = b.actualDurationSeconds ?? Number.NEGATIVE_INFINITY;
      if (ad !== bd) {
        return ad > bd ? 1 : -1;
      }
      const aw = a.actualWeightKg;
      const bw = b.actualWeightKg;
      if (aw != null || bw != null) {
        const aWeight = aw ?? Number.NEGATIVE_INFINITY;
        const bWeight = bw ?? Number.NEGATIVE_INFINITY;
        if (aWeight !== bWeight) {
          return aWeight > bWeight ? 1 : -1;
        }
      }
      return 0;
    }
    case 'MAX_DISTANCE': {
      const ad = a.actualDistanceMeters ?? Number.NEGATIVE_INFINITY;
      const bd = b.actualDistanceMeters ?? Number.NEGATIVE_INFINITY;
      if (ad !== bd) {
        return ad > bd ? 1 : -1;
      }
      // Même distance : durée la plus courte gagne (tie-break allure).
      const aDur = a.actualDurationSeconds;
      const bDur = b.actualDurationSeconds;
      if (aDur != null && bDur != null && aDur !== bDur) {
        return aDur < bDur ? 1 : -1;
      }
      if (aDur != null && bDur == null) {
        return 1;
      }
      if (aDur == null && bDur != null) {
        return -1;
      }
      return 0;
    }
    default: {
      const _exhaustive: never = recordType;
      return _exhaustive;
    }
  }
}

/**
 * Tie-break final déterministe : première occurrence (date locale la plus ancienne),
 * puis identifiant de série stable.
 * Retourne > 0 si `a` gagne l’égalité, < 0 si `b` gagne.
 */
export function comparePersonalRecordTieBreak(
  a: Pick<PersonalRecordCandidate, 'achievedOn' | 'workoutSetId'>,
  b: Pick<PersonalRecordCandidate, 'achievedOn' | 'workoutSetId'>,
): number {
  if (a.achievedOn !== b.achievedOn) {
    return a.achievedOn < b.achievedOn ? 1 : -1;
  }
  if (a.workoutSetId !== b.workoutSetId) {
    return a.workoutSetId < b.workoutSetId ? 1 : -1;
  }
  return 0;
}

/** `true` si `candidate` doit remplacer `current` comme record courant. */
export function isBetterPersonalRecordCandidate(
  recordType: PersonalRecordType,
  candidate: PersonalRecordCandidate,
  current: PersonalRecordCandidate,
): boolean {
  const primary = comparePersonalRecordPrimary(recordType, candidate, current);
  if (primary > 0) {
    return true;
  }
  if (primary < 0) {
    return false;
  }
  return comparePersonalRecordTieBreak(candidate, current) > 0;
}

/**
 * Réduit une liste de candidats éligibles aux records courants
 * (un par exercice + équipement + type).
 */
export function selectCurrentPersonalRecords(
  candidates: PersonalRecordCandidate[],
): PersonalRecordCandidate[] {
  const bestByKey = new Map<
    string,
    { recordType: PersonalRecordType; candidate: PersonalRecordCandidate }
  >();

  for (const candidate of candidates) {
    if (
      !isSetEligibleForPersonalRecord({
        sessionStatus: 'COMPLETED',
        setStatus: 'COMPLETED',
        setType: candidate.setType,
        sourceExerciseId: candidate.sourceExerciseId,
      })
    ) {
      continue;
    }

    const types = resolveRecordTypesForMeasurement(
      candidate.measurementTypeSnapshot,
    );
    for (const recordType of types) {
      const principal = getPersonalRecordPrincipalValue(recordType, candidate);
      if (principal == null) {
        continue;
      }
      const key = personalRecordGroupKey(
        candidate.sourceExerciseId,
        candidate.equipmentTypeId,
        recordType,
      );
      const existing = bestByKey.get(key);
      if (
        !existing ||
        isBetterPersonalRecordCandidate(
          recordType,
          candidate,
          existing.candidate,
        )
      ) {
        bestByKey.set(key, { recordType, candidate });
      }
    }
  }

  return [...bestByKey.values()].map((entry) => entry.candidate);
}

/** Variante qui conserve aussi le recordType gagnant (pour mapping API). */
export function selectCurrentPersonalRecordsWithType(
  candidates: PersonalRecordCandidate[],
): Array<{ recordType: PersonalRecordType; candidate: PersonalRecordCandidate }> {
  const bestByKey = new Map<
    string,
    { recordType: PersonalRecordType; candidate: PersonalRecordCandidate }
  >();

  for (const candidate of candidates) {
    if (
      !isSetEligibleForPersonalRecord({
        sessionStatus: 'COMPLETED',
        setStatus: 'COMPLETED',
        setType: candidate.setType,
        sourceExerciseId: candidate.sourceExerciseId,
      })
    ) {
      continue;
    }

    const types = resolveRecordTypesForMeasurement(
      candidate.measurementTypeSnapshot,
    );
    for (const recordType of types) {
      const principal = getPersonalRecordPrincipalValue(recordType, candidate);
      if (principal == null) {
        continue;
      }
      const key = personalRecordGroupKey(
        candidate.sourceExerciseId,
        candidate.equipmentTypeId,
        recordType,
      );
      const existing = bestByKey.get(key);
      if (
        !existing ||
        isBetterPersonalRecordCandidate(
          recordType,
          candidate,
          existing.candidate,
        )
      ) {
        bestByKey.set(key, { recordType, candidate });
      }
    }
  }

  return [...bestByKey.values()];
}

export type PersonalRecordsSortKey = {
  achievedOn: string;
  exerciseId: string;
  equipmentTypeId: string | null;
  recordType: PersonalRecordType;
};

/** Tri liste globale : achievedOn DESC, exerciseId ASC, equipment ASC, recordType ASC. */
export function comparePersonalRecordsSort(
  a: PersonalRecordsSortKey,
  b: PersonalRecordsSortKey,
): number {
  if (a.achievedOn !== b.achievedOn) {
    return a.achievedOn > b.achievedOn ? -1 : 1;
  }
  if (a.exerciseId !== b.exerciseId) {
    return a.exerciseId < b.exerciseId ? -1 : 1;
  }
  const aEq = a.equipmentTypeId ?? '';
  const bEq = b.equipmentTypeId ?? '';
  if (aEq !== bEq) {
    return aEq < bEq ? -1 : 1;
  }
  if (a.recordType !== b.recordType) {
    return a.recordType < b.recordType ? -1 : 1;
  }
  return 0;
}

export const listPersonalRecordsLimitSchema = z.preprocess(
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

export const personalRecordsQuerySchema = z.object({
  exerciseId: z.preprocess(
    emptyQueryToUndefined,
    z.string().uuid().optional(),
  ),
  recordType: z.preprocess(
    emptyQueryToUndefined,
    personalRecordTypeSchema.optional(),
  ),
  cursor: z.preprocess(emptyQueryToUndefined, z.string().min(1).optional()),
  limit: listPersonalRecordsLimitSchema,
});

export type PersonalRecordsQuery = z.infer<typeof personalRecordsQuerySchema>;

export type PersonalRecordsQueryParseErrorCode =
  | 'PERSONAL_RECORD_INVALID_TYPE'
  | 'PERSONAL_RECORD_INVALID_CURSOR'
  | 'PERSONAL_RECORD_INVALID_QUERY';

export type PersonalRecordsQueryParseResult =
  | { ok: true; data: PersonalRecordsQuery }
  | { ok: false; code: PersonalRecordsQueryParseErrorCode; message: string };

function personalRecordsQueryErrorMessage(
  code: PersonalRecordsQueryParseErrorCode,
): string {
  switch (code) {
    case 'PERSONAL_RECORD_INVALID_TYPE':
      return 'Type de record invalide.';
    case 'PERSONAL_RECORD_INVALID_CURSOR':
      return 'Cursor de pagination invalide.';
    case 'PERSONAL_RECORD_INVALID_QUERY':
      return 'Paramètres de liste invalides.';
  }
}

export function parsePersonalRecordsQuery(
  raw: unknown,
): PersonalRecordsQueryParseResult {
  const result = personalRecordsQuerySchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  for (const issue of result.error.issues) {
    if (issue.path[0] === 'recordType') {
      return {
        ok: false,
        code: 'PERSONAL_RECORD_INVALID_TYPE',
        message: personalRecordsQueryErrorMessage(
          'PERSONAL_RECORD_INVALID_TYPE',
        ),
      };
    }
  }

  return {
    ok: false,
    code: 'PERSONAL_RECORD_INVALID_QUERY',
    message: personalRecordsQueryErrorMessage('PERSONAL_RECORD_INVALID_QUERY'),
  };
}

export type PersonalRecordsCursorPayload = {
  version: 1;
  achievedOn: string;
  exerciseId: string;
  equipmentTypeId: string | null;
  recordType: PersonalRecordType;
};

export function encodePersonalRecordsCursor(
  payload: PersonalRecordsCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodePersonalRecordsCursor(
  cursor: string,
): PersonalRecordsCursorPayload {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('PERSONAL_RECORD_INVALID_CURSOR');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { achievedOn?: unknown }).achievedOn !== 'string' ||
    typeof (parsed as { exerciseId?: unknown }).exerciseId !== 'string' ||
    typeof (parsed as { recordType?: unknown }).recordType !== 'string' ||
    ((parsed as { equipmentTypeId?: unknown }).equipmentTypeId !== null &&
      typeof (parsed as { equipmentTypeId?: unknown }).equipmentTypeId !==
        'string')
  ) {
    throw new Error('PERSONAL_RECORD_INVALID_CURSOR');
  }

  const recordType = personalRecordTypeSchema.safeParse(
    (parsed as { recordType: string }).recordType,
  );
  if (!recordType.success) {
    throw new Error('PERSONAL_RECORD_INVALID_CURSOR');
  }

  const achievedOn = (parsed as { achievedOn: string }).achievedOn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(achievedOn)) {
    throw new Error('PERSONAL_RECORD_INVALID_CURSOR');
  }

  return {
    version: 1,
    achievedOn,
    exerciseId: (parsed as { exerciseId: string }).exerciseId,
    equipmentTypeId: (parsed as { equipmentTypeId: string | null })
      .equipmentTypeId,
    recordType: recordType.data,
  };
}

/** `true` si `item` est strictement après le curseur dans l’ordre de tri. */
export function isPersonalRecordAfterCursor(
  item: PersonalRecordsSortKey,
  cursor: PersonalRecordsCursorPayload,
): boolean {
  return comparePersonalRecordsSort(item, cursor) > 0;
}
