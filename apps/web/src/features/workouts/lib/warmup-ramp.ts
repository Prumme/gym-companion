import { calculatePlates, kgToGrams, type PlatePerSide } from './plate-calculator';

/**
 * Rampe d’échauffement suggérée (V1, lecture seule, aucune écriture).
 * Règle (docs/04 §5.6) : barre × 10, puis 40 % × 5, 60 % × 3, 80 % × 1 de la charge
 * de travail, chaque palier arrondi à la charge chargeable inférieure via le calculateur
 * de disques ; les paliers qui n’apportent rien (doublon, ≤ barre, ≥ travail) sont retirés.
 */

export type WarmupStepRule =
  { kind: 'BAR'; reps: number } | { kind: 'PERCENT'; percent: number; reps: number };

export const DEFAULT_WARMUP_STEPS: readonly WarmupStepRule[] = [
  { kind: 'BAR', reps: 10 },
  { kind: 'PERCENT', percent: 40, reps: 5 },
  { kind: 'PERCENT', percent: 60, reps: 3 },
  { kind: 'PERCENT', percent: 80, reps: 1 },
];

export type WarmupStep = {
  /** Pourcentage de la charge de travail, `null` pour la barre seule. */
  percent: number | null;
  reps: number;
  loadKg: number;
  perSide: PlatePerSide[];
};

export type WarmupRampResult =
  | { status: 'OK'; steps: WarmupStep[] }
  /** Charge de travail absente, invalide ou inférieure ou égale à la barre. */
  | { status: 'NOT_APPLICABLE'; steps: never[] };

export type WarmupRampInput = {
  workingKg: number | null | undefined;
  barKg: number;
  platesKg: readonly number[];
  steps?: readonly WarmupStepRule[];
};

export function computeWarmupRamp(input: WarmupRampInput): WarmupRampResult {
  const { workingKg, barKg, platesKg } = input;
  const rules = input.steps ?? DEFAULT_WARMUP_STEPS;
  if (workingKg == null || !Number.isFinite(workingKg) || !Number.isFinite(barKg) || barKg < 0) {
    return { status: 'NOT_APPLICABLE', steps: [] };
  }
  const workingG = kgToGrams(workingKg);
  const barG = kgToGrams(barKg);
  if (workingG <= barG) {
    return { status: 'NOT_APPLICABLE', steps: [] };
  }

  const steps: WarmupStep[] = [];
  let previousG = -1;

  for (const rule of rules) {
    if (rule.kind === 'BAR') {
      if (barG > previousG) {
        steps.push({ percent: null, reps: rule.reps, loadKg: barG / 1000, perSide: [] });
        previousG = barG;
      }
      continue;
    }
    // Pourcentage en grammes entiers, arrondi inférieur.
    const rawG = Math.floor((workingG * rule.percent) / 100);
    const result = calculatePlates({ targetKg: rawG / 1000, barKg, plates: platesKg });
    if (result.status !== 'EXACT' && result.status !== 'APPROXIMATE') {
      continue;
    }
    const loadG = kgToGrams(result.achievableKg);
    if (loadG <= barG || loadG <= previousG || loadG >= workingG) {
      continue;
    }
    steps.push({
      percent: rule.percent,
      reps: rule.reps,
      loadKg: result.achievableKg,
      perSide: result.perSide,
    });
    previousG = loadG;
  }

  return { status: 'OK', steps };
}
