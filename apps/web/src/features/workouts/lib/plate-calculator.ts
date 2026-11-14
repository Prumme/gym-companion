import type { WorkoutSessionExerciseDetail, WorkoutSessionSetDetail } from '@gym-companion/shared';

/**
 * Calculateur de disques (V1, kg uniquement). Tous les calculs se font en grammes
 * entiers pour éviter les erreurs de flottants (ex. 2,5 + 1,25).
 *
 * Règle (docs/04 §5.5) : algorithme glouton du disque le plus lourd au plus léger,
 * la charge chargée ne dépasse jamais la cible (arrondi inférieur) et l’écart est affiché.
 */

export const DEFAULT_BAR_WEIGHT_KG = 20;
export const DEFAULT_PLATES_KG: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25];

export type PlateStock = {
  weightKg: number;
  /** Nombre de paires disponibles ; absent = illimité. */
  pairs?: number;
};

export type PlateCalculationInput = {
  targetKg: number;
  barKg: number;
  plates: readonly (number | PlateStock)[];
};

export type PlatePerSide = { weightKg: number; count: number };

export type PlateCalculationStatus =
  /** Cible atteinte exactement. */
  | 'EXACT'
  /** Cible non atteignable exactement : charge inférieure la plus proche par l’algorithme glouton. */
  | 'APPROXIMATE'
  /** Cible inférieure au poids de la barre : barre seule. */
  | 'BELOW_BAR'
  /** Entrée invalide (non finie, négative, barre absente). */
  | 'INVALID';

export type PlateCalculationResult = {
  status: PlateCalculationStatus;
  perSide: PlatePerSide[];
  /** Charge réellement chargée (barre + disques), kg. */
  achievableKg: number;
  /** Cible − charge chargée, kg (négatif si la cible est sous la barre). */
  differenceKg: number;
};

const GRAMS_PER_KG = 1000;

export function kgToGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG);
}

export function gramsToKg(grams: number): number {
  return grams / GRAMS_PER_KG;
}

function normalizeStock(
  plates: PlateCalculationInput['plates'],
): { grams: number; pairs: number }[] {
  const byWeight = new Map<number, number>();
  for (const plate of plates) {
    const stock: PlateStock = typeof plate === 'number' ? { weightKg: plate } : plate;
    if (!Number.isFinite(stock.weightKg) || stock.weightKg <= 0) {
      continue;
    }
    const grams = kgToGrams(stock.weightKg);
    if (grams <= 0) {
      continue;
    }
    const pairs =
      stock.pairs === undefined
        ? Number.POSITIVE_INFINITY
        : Number.isFinite(stock.pairs)
          ? Math.max(0, Math.floor(stock.pairs))
          : Number.POSITIVE_INFINITY;
    byWeight.set(grams, (byWeight.get(grams) ?? 0) + pairs);
  }
  return [...byWeight.entries()]
    .map(([grams, pairs]) => ({ grams, pairs }))
    .filter((stock) => stock.pairs > 0)
    .sort((a, b) => b.grams - a.grams);
}

export function calculatePlates(input: PlateCalculationInput): PlateCalculationResult {
  const { targetKg, barKg } = input;
  if (!Number.isFinite(targetKg) || !Number.isFinite(barKg) || targetKg < 0 || barKg < 0) {
    return { status: 'INVALID', perSide: [], achievableKg: 0, differenceKg: 0 };
  }

  const targetG = kgToGrams(targetKg);
  const barG = kgToGrams(barKg);

  if (targetG < barG) {
    return {
      status: 'BELOW_BAR',
      perSide: [],
      achievableKg: gramsToKg(barG),
      differenceKg: gramsToKg(targetG - barG),
    };
  }

  // Charge par côté : arrondi inférieur au gramme (cible − barre impaire en grammes).
  let remainingPerSideG = Math.floor((targetG - barG) / 2);
  const perSide: PlatePerSide[] = [];
  let loadedPerSideG = 0;

  for (const stock of normalizeStock(input.plates)) {
    if (remainingPerSideG < stock.grams) {
      continue;
    }
    const count = Math.min(Math.floor(remainingPerSideG / stock.grams), stock.pairs);
    if (count <= 0) {
      continue;
    }
    perSide.push({ weightKg: gramsToKg(stock.grams), count });
    remainingPerSideG -= count * stock.grams;
    loadedPerSideG += count * stock.grams;
  }

  const achievableG = barG + 2 * loadedPerSideG;
  const differenceG = targetG - achievableG;
  return {
    status: differenceG === 0 ? 'EXACT' : 'APPROXIMATE',
    perSide,
    achievableKg: gramsToKg(achievableG),
    differenceKg: gramsToKg(differenceG),
  };
}

/** Charge chargeable ≤ cible, arrondie aux disques disponibles. */
export function roundDownToLoadableKg(input: PlateCalculationInput): number {
  const result = calculatePlates(input);
  return result.status === 'INVALID' ? 0 : result.achievableKg;
}

/** Barre identifiée par le code d’équipement du snapshot (seed `reference-seed-data.json` : `barbell`). */
export function isBarbellEquipmentCode(code: string | null | undefined): boolean {
  return code != null && code.trim().toLowerCase() === 'barbell';
}

/** Le calculateur n’est proposé que pour `WEIGHT_REPS` sur une barre. */
export function supportsPlateCalculator(
  exercise: Pick<WorkoutSessionExerciseDetail, 'measurementType' | 'equipment'>,
): boolean {
  return (
    exercise.measurementType === 'WEIGHT_REPS' && isBarbellEquipmentCode(exercise.equipment.code)
  );
}

/**
 * Charge pré-remplie : cible de la série à faire, sinon sa saisie, sinon la dernière
 * charge saisie sur l’exercice dans la séance.
 */
export function resolvePlateCalculatorTargetKg(
  sets: readonly WorkoutSessionSetDetail[],
  nextSet: WorkoutSessionSetDetail | null | undefined,
): number | null {
  if (nextSet?.targetWeightKg != null) {
    return nextSet.targetWeightKg;
  }
  if (nextSet?.actualWeightKg != null) {
    return nextSet.actualWeightKg;
  }
  const lastEntered = [...sets]
    .filter((set) => set.actualWeightKg != null)
    .sort((a, b) => b.position - a.position)[0];
  if (lastEntered?.actualWeightKg != null) {
    return lastEntered.actualWeightKg;
  }
  const firstTarget = [...sets]
    .sort((a, b) => a.position - b.position)
    .find((set) => set.targetWeightKg != null);
  return firstTarget?.targetWeightKg ?? null;
}

export function formatPlateKg(kg: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(kg)} kg`;
}

/** Ex. « 2 × 20 kg + 2,5 kg » ; « Aucun disque » si la barre suffit. */
export function formatPlatesPerSide(perSide: readonly PlatePerSide[]): string {
  if (perSide.length === 0) {
    return 'Aucun disque';
  }
  return perSide
    .map(({ weightKg, count }) =>
      count > 1 ? `${count} × ${formatPlateKg(weightKg)}` : formatPlateKg(weightKg),
    )
    .join(' + ');
}

/** Saisie utilisateur (virgule ou point décimal) → kg, `null` si vide ou invalide. */
export function parseKgInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const kg = Number(normalized);
  return Number.isFinite(kg) && kg >= 0 ? kg : null;
}
