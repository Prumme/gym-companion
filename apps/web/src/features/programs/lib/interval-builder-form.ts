import {
  INTERVAL_PLAN_MAX_ROUNDS,
  INTERVAL_PRESETS,
  intervalPlanSchema,
  type IntervalPlan,
  type IntervalPreset,
} from '@gym-companion/validation';
import { z } from 'zod';

/** Valeurs brutes du formulaire « Créer un fractionné » (saisie texte mobile). */
export type IntervalBuilderFormValues = {
  rounds: string;
  workSeconds: string;
  workSpeedKmh: string;
  workInclinePercent: string;
  recoverySeconds: string;
  recoverySpeedKmh: string;
  warmupMinutes: string;
  cooldownMinutes: string;
};

const DEFAULT_PRESET = INTERVAL_PRESETS[0]!;

export function defaultIntervalBuilderValues(): IntervalBuilderFormValues {
  return {
    rounds: String(DEFAULT_PRESET.rounds),
    workSeconds: String(DEFAULT_PRESET.workSeconds),
    workSpeedKmh: '8',
    workInclinePercent: '',
    recoverySeconds: String(DEFAULT_PRESET.recoverySeconds),
    recoverySpeedKmh: '4',
    warmupMinutes: '5',
    cooldownMinutes: '',
  };
}

export function applyIntervalPreset(
  values: IntervalBuilderFormValues,
  preset: IntervalPreset,
): IntervalBuilderFormValues {
  return {
    ...values,
    rounds: String(preset.rounds),
    workSeconds: String(preset.workSeconds),
    recoverySeconds: String(preset.recoverySeconds),
  };
}

const optionalNumber = (raw: string) => {
  const trimmed = raw.trim().replace(',', '.');
  return trimmed === '' ? null : Number(trimmed);
};

/** Convertit la saisie en plan ; renvoie les erreurs par champ. */
export function intervalBuilderValuesToPlan(
  values: IntervalBuilderFormValues,
):
  | { ok: true; plan: IntervalPlan }
  | { ok: false; errors: Partial<Record<keyof IntervalBuilderFormValues, string>> } {
  const warmup = optionalNumber(values.warmupMinutes);
  const cooldown = optionalNumber(values.cooldownMinutes);
  const candidate = {
    rounds: optionalNumber(values.rounds) ?? Number.NaN,
    work: {
      durationSeconds: optionalNumber(values.workSeconds) ?? Number.NaN,
      speedKmh: optionalNumber(values.workSpeedKmh),
      inclinePercent: optionalNumber(values.workInclinePercent),
    },
    recovery: {
      durationSeconds: optionalNumber(values.recoverySeconds) ?? Number.NaN,
      speedKmh: optionalNumber(values.recoverySpeedKmh),
      inclinePercent: null,
    },
    warmupSeconds: warmup == null ? null : Math.round(warmup * 60),
    cooldownSeconds: cooldown == null ? null : Math.round(cooldown * 60),
  };
  const parsed = intervalPlanSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, plan: parsed.data };

  const fieldByPath: Record<string, keyof IntervalBuilderFormValues> = {
    rounds: 'rounds',
    'work.durationSeconds': 'workSeconds',
    'work.speedKmh': 'workSpeedKmh',
    'work.inclinePercent': 'workInclinePercent',
    'recovery.durationSeconds': 'recoverySeconds',
    'recovery.speedKmh': 'recoverySpeedKmh',
    warmupSeconds: 'warmupMinutes',
    cooldownSeconds: 'cooldownMinutes',
  };
  const messages: Record<keyof IntervalBuilderFormValues, string> = {
    rounds: `Entre 1 et ${INTERVAL_PLAN_MAX_ROUNDS} répétitions.`,
    workSeconds: 'Durée d’effort entre 5 s et 1 h.',
    workSpeedKmh: 'Vitesse invalide.',
    workInclinePercent: 'Inclinaison invalide.',
    recoverySeconds: 'Durée de récup entre 5 s et 1 h.',
    recoverySpeedKmh: 'Vitesse invalide.',
    warmupMinutes: 'Échauffement invalide (60 min max).',
    cooldownMinutes: 'Retour au calme invalide (60 min max).',
  };
  const errors: Partial<Record<keyof IntervalBuilderFormValues, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = fieldByPath[issue.path.join('.')];
    if (field) errors[field] = messages[field];
  }
  return { ok: false, errors };
}

/** Schéma de formulaire (RHF) : texte libre, la conversion valide le plan. */
export const intervalBuilderFormSchema = z
  .object({
    rounds: z.string(),
    workSeconds: z.string(),
    workSpeedKmh: z.string(),
    workInclinePercent: z.string(),
    recoverySeconds: z.string(),
    recoverySpeedKmh: z.string(),
    warmupMinutes: z.string(),
    cooldownMinutes: z.string(),
  })
  .superRefine((values, ctx) => {
    const result = intervalBuilderValuesToPlan(values);
    if (result.ok) return;
    for (const [field, message] of Object.entries(result.errors)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
    }
  });
