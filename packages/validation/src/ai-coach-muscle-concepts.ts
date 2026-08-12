/**
 * Concepts utilisateur → codes MuscleGroup du référentiel (pas d’UUID).
 * Un label exact déjà présent en BDD (ex. « Dos », « Biceps ») n’utilise pas cette table.
 */
export const AI_COACH_MUSCLE_CONCEPT_ALIASES: Readonly<
  Record<string, readonly string[]>
> = {
  bras: ['biceps', 'triceps'],
  arms: ['biceps', 'triceps'],
  arm: ['biceps', 'triceps'],
  jambes: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  jambe: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  leg: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  'haut du corps': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  'upper body': ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  'full body': [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'core',
  ],
  fullbody: [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'core',
  ],
  pecs: ['chest'],
  pec: ['chest'],
  poitrine: ['chest'],
};

function normalizeConceptLabel(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Si `label` est un concept composite (ou alias), retourne les codes MuscleGroup
 * à résoudre côté backend. Sinon `null` (match exact attendu).
 */
export function resolveAiCoachMuscleConcept(
  label: string,
): readonly string[] | null {
  const needle = normalizeConceptLabel(label);
  if (!needle) return null;
  return AI_COACH_MUSCLE_CONCEPT_ALIASES[needle] ?? null;
}

/** Clé de log sûre (pas d’UUID) pour un concept résolu. */
export function aiCoachMuscleConceptKey(label: string): string | null {
  const needle = normalizeConceptLabel(label);
  if (!needle) return null;
  if (AI_COACH_MUSCLE_CONCEPT_ALIASES[needle]) return needle;
  return null;
}
