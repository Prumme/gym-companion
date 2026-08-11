import type {
  PlateauAnalysis,
  PlateauReason,
  PlateauStatus,
  PlateauWorkoutPoint,
} from '@gym-companion/shared';

const STATUS_LABELS: Record<PlateauStatus, string> = {
  NONE: 'Progression régulière',
  WATCH: 'Progression à surveiller',
  PLATEAU: 'Stagnation possible',
  INSUFFICIENT_DATA: 'Pas encore assez de données',
  REVIEW: 'Analyse automatique limitée',
};

const REASON_MESSAGES: Record<PlateauReason, string> = {
  NO_ELIGIBLE_HISTORY:
    'Pas encore de séances terminées exploitables pour cet exercice.',
  INSUFFICIENT_WORKOUTS:
    'Pas encore assez de séances comparables pour analyser une éventuelle stagnation.',
  INCONSISTENT_EQUIPMENT:
    'Les dernières séances utilisent des équipements différents, ce qui rend la comparaison moins fiable.',
  INCONSISTENT_TARGETS:
    'Les dernières séances utilisent des configurations différentes, ce qui rend la comparaison moins fiable.',
  LOAD_NOT_INCREASING: 'La charge maximale n’a pas progressé sur la période analysée.',
  MAX_REPS_NOT_INCREASING:
    'Le nombre de répétitions maximales est resté stable.',
  E1RM_NOT_INCREASING: 'Le 1RM estimé n’a pas progressé de façon significative.',
  REPEATED_TARGET_MISSES:
    'La plage de répétitions cible n’a pas été atteinte sur plusieurs séances.',
  REPEATED_FAILURES:
    'Des séries partielles ou échouées se sont répétées sur plusieurs séances.',
  EFFORT_TREND_HIGH:
    'L’effort déclaré devient plus élevé à performances stables.',
  RECENT_PROGRESS_DETECTED:
    'Une progression récente a été détectée sur les dernières séances.',
  UNSUPPORTED_MEASUREMENT_TYPE:
    'Aucune analyse de stagnation pour ce type d’exercice.',
  SOURCE_EXERCISE_MISSING:
    'Les séances sans exercice source lié ne sont pas analysées.',
};

function formatKg(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(value)} kg`;
}

export function getPlateauStatusLabel(status: PlateauStatus): string {
  return STATUS_LABELS[status];
}

export function getPlateauReasonMessage(reason: PlateauReason): string {
  return REASON_MESSAGES[reason];
}

export function getPlateauPrimaryMessage(analysis: PlateauAnalysis): string {
  switch (analysis.status) {
    case 'PLATEAU':
      return 'Tes dernières performances évoluent peu sur la période analysée.';
    case 'NONE':
      return 'Pas de stagnation détectée.';
    case 'WATCH':
      return `Tes performances sont restées proches sur les ${analysis.range.analyzedWorkoutCount} dernières séances.`;
    case 'INSUFFICIENT_DATA':
      return 'Pas encore assez de séances comparables pour analyser une éventuelle stagnation.';
    case 'REVIEW':
      return 'Les dernières séances utilisent des configurations différentes, ce qui rend la comparaison moins fiable.';
    default:
      return '';
  }
}

export function formatPlateauTrendLine(analysis: PlateauAnalysis): string | null {
  if (analysis.range.analyzedWorkoutCount < 2) {
    return null;
  }
  const parts: string[] = [];
  if (
    analysis.current.maxWeightKg != null &&
    analysis.trend.loadChangeKg != null
  ) {
    const previous =
      analysis.current.maxWeightKg - analysis.trend.loadChangeKg;
    parts.push(
      `Charge max : ${formatKg(previous)} → ${formatKg(analysis.current.maxWeightKg)}`,
    );
  }
  if (
    analysis.current.estimatedOneRepMaxKg != null &&
    analysis.trend.e1rmChangeKg != null
  ) {
    const previous =
      analysis.current.estimatedOneRepMaxKg - analysis.trend.e1rmChangeKg;
    parts.push(
      `e1RM estimé : ${formatKg(previous)} → ${formatKg(analysis.current.estimatedOneRepMaxKg)}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatPlateauEvidenceLine(point: PlateauWorkoutPoint): string {
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${point.localDate}T12:00:00`));
  const weight =
    point.maxWeightKg != null ? formatKg(point.maxWeightKg) : '—';
  const reps =
    point.maxReps != null ? `${point.maxReps} reps max` : 'reps n/d';
  const e1rm =
    point.bestEstimatedOneRepMaxKg != null
      ? `e1RM ${formatKg(point.bestEstimatedOneRepMaxKg)}`
      : 'e1RM n/d';
  return `${date} · ${weight} · ${reps} · ${e1rm}`;
}
