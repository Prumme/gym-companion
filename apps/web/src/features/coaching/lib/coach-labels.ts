import type {
  ExerciseCoachStatus,
  LoadRecommendationAction,
  LoadRecommendationDecisionType,
} from '@gym-companion/shared';

const STATUS_LABELS: Record<ExerciseCoachStatus, string> = {
  NO_DATA: 'Pas encore assez de données',
  BUILDING_HISTORY: 'Historique en construction',
  PROGRESSING: 'Progression récente',
  STABLE: 'Progression stable',
  WATCH: 'Progression à surveiller',
  PLATEAU: 'Stagnation possible',
  REVIEW: 'Analyse à vérifier',
};

const LOAD_ACTION_LABELS: Record<LoadRecommendationAction, string> = {
  INCREASE: 'Augmenter la charge',
  HOLD: 'Conserver la charge',
  DECREASE: 'Réduire la charge',
  REVIEW: 'À vérifier',
  INSUFFICIENT_DATA: 'Pas assez de données',
};

const DECISION_LABELS: Record<LoadRecommendationDecisionType, string> = {
  ACCEPTED: 'Acceptée',
  ADJUSTED: 'Ajustée',
  IGNORED: 'Ignorée',
};

export function getExerciseCoachStatusLabel(
  status: ExerciseCoachStatus,
): string {
  return STATUS_LABELS[status];
}

export function getCoachLoadActionLabel(
  action: LoadRecommendationAction,
): string {
  return LOAD_ACTION_LABELS[action];
}

export function getCoachDecisionLabel(
  decision: LoadRecommendationDecisionType,
): string {
  return DECISION_LABELS[decision];
}

export function formatCoachWeightKg(value: number | null): string | null {
  if (value == null) return null;
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(value)} kg`;
}
