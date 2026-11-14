/**
 * Calculs purs de positions de séries d’un exercice de séance.
 */

export type PositionedSet = {
  id: string;
  position: number;
  setType: string;
};

export type WarmupInsertionPlan = {
  /** Positions des nouvelles séries WARMUP, dans l’ordre de la rampe. */
  newPositions: number[];
  /** Positions finales des séries existantes (toutes, recompactées 0..n-1 autour de l’insertion). */
  existing: { id: string; position: number }[];
};

/**
 * Insère `count` séries WARMUP juste avant la première série qui n’est pas WARMUP
 * (donc après d’éventuelles séries WARMUP déjà présentes). Sans série non-WARMUP,
 * l’insertion se fait à la fin. Les positions résultantes sont contiguës à partir de 0.
 */
export function planWarmupInsertion(
  sets: readonly PositionedSet[],
  count: number,
): WarmupInsertionPlan {
  const ordered = [...sets].sort((a, b) => a.position - b.position);
  const firstNonWarmup = ordered.findIndex((set) => set.setType !== 'WARMUP');
  const insertAt = firstNonWarmup === -1 ? ordered.length : firstNonWarmup;
  const safeCount = Math.max(0, Math.trunc(count));

  return {
    newPositions: Array.from({ length: safeCount }, (_, index) => insertAt + index),
    existing: ordered.map((set, index) => ({
      id: set.id,
      position: index < insertAt ? index : index + safeCount,
    })),
  };
}

/**
 * Identifiant de commande dérivé pour la i-ème série d’une commande groupée
 * (la première garde l’identifiant tel quel).
 */
export function deriveBatchSetCommandId(clientCommandId: string, index: number): string {
  return index === 0 ? clientCommandId : `${clientCommandId}:${index}`;
}
