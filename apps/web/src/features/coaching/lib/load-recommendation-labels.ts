import type {
  LoadIncrementSource,
  LoadRecommendation,
  LoadRecommendationAction,
  LoadRecommendationReason,
} from '@gym-companion/shared';

const ACTION_LABELS: Record<LoadRecommendationAction, string> = {
  INCREASE: 'Augmenter la charge',
  HOLD: 'Conserver la charge',
  DECREASE: 'Réduire la charge',
  INSUFFICIENT_DATA: 'Pas encore assez de données',
  REVIEW: 'Progression à vérifier',
};

const REASON_MESSAGES: Record<LoadRecommendationReason, string> = {
  TARGET_RANGE_REACHED:
    'Tu as atteint le haut de ta plage de répétitions sur tes séries de travail.',
  TARGET_RANGE_PARTIALLY_REACHED:
    'La charge actuelle reste adaptée à ta plage cible.',
  TARGET_RANGE_NOT_REACHED:
    'Les séances récentes sont restées sous la plage de répétitions prévue.',
  EFFORT_ON_TARGET: 'L’effort déclaré reste cohérent avec la cible.',
  EFFORT_TOO_HIGH: 'L’effort déclaré est nettement plus élevé que prévu.',
  EFFORT_LOWER_THAN_TARGET:
    'L’effort déclaré était plus facile que la cible prévue.',
  RECENT_FAILURES: 'Des séries partielles ou échouées se sont répétées.',
  NO_ELIGIBLE_HISTORY:
    'Pas encore assez de séances terminées pour proposer une charge.',
  NO_WORKING_SETS: 'Aucune série de travail exploitable n’a été trouvée.',
  UNSUPPORTED_TARGET_CONFIGURATION:
    'Les séries de travail utilisent plusieurs charges ou plages de répétitions différentes. La recommandation automatique est désactivée pour cette configuration.',
  INCONSISTENT_EQUIPMENT:
    'L’équipement des séances récentes ne correspond pas à celui du modèle. La comparaison de charge est désactivée.',
  INSUFFICIENT_EFFORT_DATA:
    'La décision repose principalement sur les répétitions et les statuts (effort peu renseigné).',
  UNSUPPORTED_MEASUREMENT_TYPE:
    'Aucune recommandation de charge n’est disponible pour ce type d’exercice.',
  NO_TARGET_WEIGHT: 'Aucune charge cible n’est définie sur les séries de travail.',
  NO_TARGET_REP_RANGE:
    'Aucune plage de répétitions exploitable n’est définie.',
  SINGLE_UNDERPERFORMANCE:
    'Une seule séance difficile ne suffit pas pour baisser la charge.',
  COMPARABLE_LOAD_MISMATCH:
    'La charge réalisée récemment diffère trop de la cible actuelle du modèle.',
};

const INCREMENT_SOURCE_LABELS: Record<LoadIncrementSource, string> = {
  SYSTEM_DEFAULT: 'Incrément système par défaut',
  USER_EXERCISE_PREFERENCE: 'Préférence d’exercice',
};

export function getLoadRecommendationActionLabel(
  action: LoadRecommendationAction,
): string {
  return ACTION_LABELS[action];
}

export function getLoadRecommendationReasonMessage(
  reason: LoadRecommendationReason,
): string {
  return REASON_MESSAGES[reason];
}

export function getPrimaryLoadRecommendationMessage(
  recommendation: LoadRecommendation,
): string {
  const primary = recommendation.reasons[0];
  if (primary) {
    return getLoadRecommendationReasonMessage(primary);
  }
  return getLoadRecommendationActionLabel(recommendation.action);
}

export function formatLoadWeightKg(kg: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(kg)} kg`;
}

export function formatLoadWeightTransition(
  currentKg: number | null,
  suggestedKg: number | null,
): string | null {
  if (currentKg == null) {
    return null;
  }
  if (suggestedKg == null) {
    return formatLoadWeightKg(currentKg);
  }
  if (currentKg === suggestedKg) {
    return formatLoadWeightKg(currentKg);
  }
  return `${formatLoadWeightKg(currentKg)} → ${formatLoadWeightKg(suggestedKg)}`;
}

export function getIncrementSourceLabel(
  source: LoadIncrementSource | null,
): string | null {
  if (!source) {
    return null;
  }
  return INCREMENT_SOURCE_LABELS[source];
}

export function formatEvidenceSummary(
  recommendation: LoadRecommendation,
): string | null {
  const count = recommendation.evidence.workoutCount;
  if (count <= 0) {
    return null;
  }
  return `Basé sur ${count} séance${count > 1 ? 's' : ''} récente${count > 1 ? 's' : ''}.`;
}
