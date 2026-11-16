/**
 * Fractionné cardio : génération des séries effort / récupération d’un modèle
 * et résumé lisible. Logique pure, partagée entre l’éditeur et l’affichage.
 */

import { z } from 'zod';

export const INTERVAL_PLAN_MAX_ROUNDS = 20;

const phaseDurationSchema = z.number().int().min(5).max(3600);
const optionalSpeedSchema = z.number().finite().positive().max(60).nullable();
const optionalInclineSchema = z.number().finite().min(-20).max(40).nullable();

export const intervalPlanSchema = z
  .object({
    rounds: z.number().int().min(1).max(INTERVAL_PLAN_MAX_ROUNDS),
    work: z
      .object({
        durationSeconds: phaseDurationSchema,
        speedKmh: optionalSpeedSchema,
        inclinePercent: optionalInclineSchema,
      })
      .strict(),
    recovery: z
      .object({
        durationSeconds: phaseDurationSchema,
        speedKmh: optionalSpeedSchema,
        inclinePercent: optionalInclineSchema,
      })
      .strict(),
    warmupSeconds: z.number().int().min(0).max(3600).nullable(),
    cooldownSeconds: z.number().int().min(0).max(3600).nullable(),
  })
  .strict();

export type IntervalPlan = z.infer<typeof intervalPlanSchema>;

export type IntervalPreset = {
  id: string;
  label: string;
  workSeconds: number;
  recoverySeconds: number;
  rounds: number;
};

/** Progression course / marche classique : 1/1 → 2/1 → 3/1. */
export const INTERVAL_PRESETS: readonly IntervalPreset[] = [
  { id: '1-1', label: '1′ / 1′', workSeconds: 60, recoverySeconds: 60, rounds: 10 },
  { id: '2-1', label: '2′ / 1′', workSeconds: 120, recoverySeconds: 60, rounds: 7 },
  { id: '3-1', label: '3′ / 1′', workSeconds: 180, recoverySeconds: 60, rounds: 5 },
];

/** Série cible générée — même forme que la création d’une série de modèle. */
export type IntervalTemplateSet = {
  setType: 'WARMUP' | 'WORKING' | 'INTERVAL_WORK' | 'INTERVAL_RECOVERY';
  targetRepMin: null;
  targetRepMax: null;
  targetDurationSeconds: number;
  targetDistanceMeters: null;
  targetWeightKg: null;
  targetIntensityPercent: null;
  targetRir: null;
  targetRpe: null;
  restSeconds: number;
  targetSpeedKmh: number | null;
  targetInclinePercent: number | null;
};

function intervalSet(
  setType: IntervalTemplateSet['setType'],
  durationSeconds: number,
  speedKmh: number | null,
  inclinePercent: number | null,
): IntervalTemplateSet {
  return {
    setType,
    targetRepMin: null,
    targetRepMax: null,
    targetDurationSeconds: durationSeconds,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: null,
    targetRpe: null,
    // Les phases s’enchaînent sans repos : la récupération est une série.
    restSeconds: 0,
    targetSpeedKmh: speedKmh,
    targetInclinePercent: inclinePercent,
  };
}

/**
 * Échauffement (WARMUP, allure de récup), puis `rounds` × effort / récupération,
 * puis retour au calme (WORKING, allure de récup). La dernière récupération est
 * omise quand un retour au calme suit.
 */
export function buildIntervalTemplateSets(input: IntervalPlan): IntervalTemplateSet[] {
  const plan = intervalPlanSchema.parse(input);
  const sets: IntervalTemplateSet[] = [];
  const easySpeed = plan.recovery.speedKmh;
  const easyIncline = plan.recovery.inclinePercent;
  const hasCooldown = plan.cooldownSeconds != null && plan.cooldownSeconds > 0;

  if (plan.warmupSeconds != null && plan.warmupSeconds > 0) {
    sets.push(intervalSet('WARMUP', plan.warmupSeconds, easySpeed, easyIncline));
  }
  for (let round = 0; round < plan.rounds; round += 1) {
    sets.push(
      intervalSet(
        'INTERVAL_WORK',
        plan.work.durationSeconds,
        plan.work.speedKmh,
        plan.work.inclinePercent,
      ),
    );
    const isLastRound = round === plan.rounds - 1;
    if (!(isLastRound && hasCooldown)) {
      sets.push(
        intervalSet(
          'INTERVAL_RECOVERY',
          plan.recovery.durationSeconds,
          plan.recovery.speedKmh,
          plan.recovery.inclinePercent,
        ),
      );
    }
  }
  if (hasCooldown) {
    sets.push(intervalSet('WORKING', plan.cooldownSeconds!, easySpeed, easyIncline));
  }
  return sets;
}

/** 60 → « 1′ », 90 → « 1′30 », 45 → « 45″ ». */
export function formatIntervalDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}″`;
  if (rest === 0) return `${minutes}′`;
  return `${minutes}′${String(rest).padStart(2, '0')}`;
}

function formatSpeed(speedKmh: number | null | undefined): string {
  if (speedKmh == null) return '';
  const value = Number.isInteger(speedKmh)
    ? String(speedKmh)
    : speedKmh.toFixed(1).replace('.', ',');
  return ` à ${value} km/h`;
}

type IntervalSummarySet = {
  setType: string;
  targetDurationSeconds: number | null;
  targetSpeedKmh?: number | null;
};

/**
 * Résumé compact d’un fractionné, ex. « Fractionné 10 × (1′ à 8 km/h / 1′ à 4 km/h) ».
 * `null` si l’exercice ne contient aucune série d’effort.
 */
export function summarizeIntervalSets(sets: readonly IntervalSummarySet[]): string | null {
  const work = sets.filter((set) => set.setType === 'INTERVAL_WORK');
  if (work.length === 0) return null;
  const recovery = sets.filter((set) => set.setType === 'INTERVAL_RECOVERY');

  const uniform = (items: IntervalSummarySet[]) =>
    items.every(
      (item) =>
        item.targetDurationSeconds === items[0]!.targetDurationSeconds &&
        (item.targetSpeedKmh ?? null) === (items[0]!.targetSpeedKmh ?? null),
    );

  if (!uniform(work) || (recovery.length > 0 && !uniform(recovery))) {
    return `Fractionné ${work.length} × effort / récup`;
  }

  const phase = (set: IntervalSummarySet) =>
    set.targetDurationSeconds == null
      ? '?'
      : `${formatIntervalDuration(set.targetDurationSeconds)}${formatSpeed(set.targetSpeedKmh)}`;

  const recoveryPart = recovery.length > 0 ? ` / ${phase(recovery[0]!)}` : '';
  return `Fractionné ${work.length} × (${phase(work[0]!)}${recoveryPart})`;
}
