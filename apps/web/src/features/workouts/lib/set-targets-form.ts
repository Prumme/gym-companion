import type { ExerciseMeasurementType, WorkoutSessionSetDetail } from '@gym-companion/shared';
import {
  getEditableSessionSetTargets,
  type WorkoutSessionSetTargetsPatch,
} from '@gym-companion/validation';

/** Valeurs brutes du formulaire « Modifier la cible » (champs texte, virgule acceptée). */
export type SetTargetsFormValues = {
  weightKg: string;
  repMin: string;
  repMax: string;
  restSeconds: string;
};

export type SetTargetsPatchResult =
  { ok: true; patch: WorkoutSessionSetTargetsPatch } | { ok: false; message: string };

const MAX_WEIGHT_KG = 10_000;
const MAX_REPS = 500;
const MAX_REST_SECONDS = 1800;

function toText(value: number | null): string {
  return value == null ? '' : String(value).replace('.', ',');
}

export function toSetTargetsFormValues(set: WorkoutSessionSetDetail): SetTargetsFormValues {
  return {
    weightKg: toText(set.targetWeightKg),
    repMin: toText(set.targetRepMin),
    repMax: toText(set.targetRepMax),
    restSeconds: toText(set.targetRestSeconds),
  };
}

type Parsed = { ok: true; value: number | null } | { ok: false };

function parseNumber(
  raw: string,
  { integer, min, max }: { integer: boolean; min: number; max: number },
): Parsed {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return { ok: true, value: null };
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < min || value > max) return { ok: false };
  if (integer && !Number.isInteger(value)) return { ok: false };
  return { ok: true, value };
}

/**
 * Construit le patch envoyé à `PATCH …/targets` : seules les cibles modifiées et
 * applicables au type de mesure. Une seule borne de reps saisie vaut pour les deux.
 */
export function buildSetTargetsPatch(
  set: WorkoutSessionSetDetail,
  measurementType: ExerciseMeasurementType,
  values: SetTargetsFormValues,
): SetTargetsPatchResult {
  const editable = getEditableSessionSetTargets(measurementType);
  const patch: WorkoutSessionSetTargetsPatch = {};

  if (editable.weight) {
    const weight = parseNumber(values.weightKg, { integer: false, min: 0, max: MAX_WEIGHT_KG });
    if (!weight.ok) return { ok: false, message: 'Charge invalide.' };
    if (weight.value !== set.targetWeightKg) patch.targetWeightKg = weight.value;
  }

  if (editable.reps) {
    const min = parseNumber(values.repMin, { integer: true, min: 1, max: MAX_REPS });
    const max = parseNumber(values.repMax, { integer: true, min: 1, max: MAX_REPS });
    if (!min.ok || !max.ok) return { ok: false, message: 'Répétitions invalides.' };
    const repMin = min.value ?? max.value;
    const repMax = max.value ?? min.value;
    if (repMin != null && repMax != null && repMin > repMax) {
      return { ok: false, message: 'Le minimum de répétitions dépasse le maximum.' };
    }
    if (repMin !== set.targetRepMin || repMax !== set.targetRepMax) {
      patch.targetRepMin = repMin;
      patch.targetRepMax = repMax;
    }
  }

  const rest = parseNumber(values.restSeconds, { integer: true, min: 0, max: MAX_REST_SECONDS });
  if (!rest.ok) return { ok: false, message: 'Repos invalide (0 à 1800 s).' };
  if (rest.value !== set.targetRestSeconds) patch.targetRestSeconds = rest.value;

  if (Object.keys(patch).length === 0) {
    return { ok: false, message: 'Aucune cible modifiée.' };
  }
  return { ok: true, patch };
}
