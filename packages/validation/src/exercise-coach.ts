/**
 * Coach déterministe explicatif (jalon 5.4).
 * Compose les résultats 4.x / 5.1 / 5.2 / 5.3 — ne recalcule pas les règles métier.
 */

import { z } from 'zod';

export const COACH_OVERVIEW_RECENCY_DAYS = 90;
export const COACH_OVERVIEW_LIMIT = 5;
export const COACH_OVERVIEW_CANDIDATE_LIMIT = 20;

export type ExerciseCoachStatus =
  | 'NO_DATA'
  | 'BUILDING_HISTORY'
  | 'PROGRESSING'
  | 'STABLE'
  | 'WATCH'
  | 'PLATEAU'
  | 'REVIEW';

export type CoachActionType =
  | 'VIEW_LOAD_RECOMMENDATION'
  | 'VIEW_PROGRESS'
  | 'VIEW_RECORDS'
  | 'VIEW_HISTORY'
  | 'VIEW_PROGRAM';

export type CoachNoticeSeverity = 'INFO' | 'ATTENTION';

export type ResolveExerciseCoachStatusInput = {
  hasCompletedHistory: boolean;
  measurementType: string;
  plateauStatus: string | null;
  loadRecommendationAction: string | null;
  /** Progression récente significative déjà établie par les moteurs (4.3 / 5.3 NONE + trend). */
  hasSignificantRecentProgress: boolean;
  /** Historique suffisant pour considérer STABLE (≥ 3 séances). */
  hasSufficientHistory: boolean;
};

const STATUS_PRIORITY: Record<ExerciseCoachStatus, number> = {
  REVIEW: 70,
  PLATEAU: 60,
  WATCH: 50,
  PROGRESSING: 40,
  STABLE: 30,
  BUILDING_HISTORY: 20,
  NO_DATA: 10,
};

export function compareExerciseCoachStatusPriority(
  a: ExerciseCoachStatus,
  b: ExerciseCoachStatus,
): number {
  return STATUS_PRIORITY[b] - STATUS_PRIORITY[a];
}

/**
 * Résout le statut UI global du Coach à partir des moteurs existants.
 */
export function resolveExerciseCoachStatus(
  input: ResolveExerciseCoachStatusInput,
): ExerciseCoachStatus {
  if (!input.hasCompletedHistory) {
    return 'NO_DATA';
  }

  if (input.loadRecommendationAction === 'REVIEW') {
    return 'REVIEW';
  }
  if (input.plateauStatus === 'REVIEW') {
    return 'REVIEW';
  }
  if (input.plateauStatus === 'PLATEAU') {
    return 'PLATEAU';
  }
  if (input.plateauStatus === 'WATCH') {
    return 'WATCH';
  }

  if (input.hasSignificantRecentProgress) {
    return 'PROGRESSING';
  }

  if (
    input.plateauStatus === 'INSUFFICIENT_DATA' ||
    input.loadRecommendationAction === 'INSUFFICIENT_DATA' ||
    !input.hasSufficientHistory
  ) {
    // Des données existent (hasCompletedHistory) mais historique encore mince.
    if (!input.hasSufficientHistory) {
      return 'BUILDING_HISTORY';
    }
  }

  if (input.hasSufficientHistory) {
    return 'STABLE';
  }

  return 'BUILDING_HISTORY';
}

export type ExerciseCoachHeadline = {
  title: string;
  description: string;
};

const HEADLINES: Record<ExerciseCoachStatus, ExerciseCoachHeadline> = {
  NO_DATA: {
    title: 'Pas encore assez de données',
    description:
      'Termine quelques séances avec cet exercice pour commencer à suivre ta progression.',
  },
  BUILDING_HISTORY: {
    title: 'Historique en construction',
    description:
      'Quelques séances sont déjà enregistrées. Continue pour affiner l’analyse.',
  },
  PROGRESSING: {
    title: 'Progression récente',
    description:
      'Ta charge ou tes performances ont progressé sur les dernières séances.',
  },
  STABLE: {
    title: 'Performances stables',
    description:
      'Tes performances sont globalement stables sur les dernières séances.',
  },
  WATCH: {
    title: 'Progression à surveiller',
    description:
      'Tes performances sont restées proches sur plusieurs séances récentes.',
  },
  PLATEAU: {
    title: 'Stagnation détectée',
    description:
      'Plusieurs séances comparables montrent peu d’évolution récente.',
  },
  REVIEW: {
    title: 'Analyse à vérifier',
    description:
      'Les dernières séances utilisent des configurations différentes, ce qui rend la comparaison moins fiable.',
  },
};

export function resolveExerciseCoachHeadline(
  status: ExerciseCoachStatus,
): ExerciseCoachHeadline {
  return HEADLINES[status];
}

export type CoachNoticeDraft = {
  code: string;
  severity: CoachNoticeSeverity;
  message: string;
};

export function buildExerciseCoachNotices(input: {
  plateauStatus: string | null;
  plateauReasons: string[];
  loadRecommendationAction: string | null;
  loadRecommendationReasons: string[];
  effortDataMissing: boolean;
}): CoachNoticeDraft[] {
  const notices: CoachNoticeDraft[] = [];

  if (
    input.plateauStatus === 'REVIEW' &&
    input.plateauReasons.includes('INCONSISTENT_EQUIPMENT')
  ) {
    notices.push({
      code: 'MIXED_EQUIPMENT',
      severity: 'ATTENTION',
      message:
        'Les dernières séances utilisent plusieurs équipements, la comparaison peut être limitée.',
    });
  }

  if (
    input.plateauStatus === 'REVIEW' &&
    input.plateauReasons.includes('INCONSISTENT_TARGETS')
  ) {
    notices.push({
      code: 'INCONSISTENT_TARGETS',
      severity: 'ATTENTION',
      message:
        'Les dernières séances utilisent des configurations différentes, ce qui rend la comparaison moins fiable.',
    });
  }

  if (
    input.loadRecommendationAction === 'REVIEW' &&
    input.loadRecommendationReasons.includes('INCONSISTENT_EQUIPMENT')
  ) {
    if (!notices.some((notice) => notice.code === 'MIXED_EQUIPMENT')) {
      notices.push({
        code: 'MIXED_EQUIPMENT',
        severity: 'ATTENTION',
        message:
          'Les dernières séances utilisent plusieurs équipements, la comparaison peut être limitée.',
      });
    }
  }

  if (input.effortDataMissing) {
    notices.push({
      code: 'EFFORT_DATA_MISSING',
      severity: 'INFO',
      message:
        'Certaines séances ne contiennent pas de RIR/RPE, l’analyse repose principalement sur les performances enregistrées.',
    });
  }

  if (
    input.loadRecommendationReasons.includes('INSUFFICIENT_EFFORT_DATA') &&
    !notices.some((notice) => notice.code === 'EFFORT_DATA_MISSING')
  ) {
    notices.push({
      code: 'EFFORT_DATA_MISSING',
      severity: 'INFO',
      message:
        'Certaines séances ne contiennent pas de RIR/RPE, l’analyse repose principalement sur les performances enregistrées.',
    });
  }

  return notices;
}

export type CoachActionDraft = {
  type: CoachActionType;
  label: string;
  href: string;
};

export function buildExerciseCoachActions(input: {
  exerciseId: string;
  programId: string | null;
  hasActionableLoadRecommendation: boolean;
  hasProgress: boolean;
}): CoachActionDraft[] {
  const actions: CoachActionDraft[] = [];
  const exerciseId = encodeURIComponent(input.exerciseId);

  if (input.hasActionableLoadRecommendation && input.programId) {
    actions.push({
      type: 'VIEW_LOAD_RECOMMENDATION',
      label: 'Voir la recommandation',
      href: `/programs/${encodeURIComponent(input.programId)}`,
    });
  } else if (input.hasActionableLoadRecommendation) {
    actions.push({
      type: 'VIEW_PROGRESS',
      label: 'Voir la recommandation',
      href: `/progress/exercises/${exerciseId}`,
    });
  }

  actions.push({
    type: 'VIEW_PROGRESS',
    label: 'Voir la progression',
    href: `/progress/exercises/${exerciseId}`,
  });

  actions.push({
    type: 'VIEW_HISTORY',
    label: 'Voir les séances',
    href: '/workouts',
  });

  actions.push({
    type: 'VIEW_RECORDS',
    label: 'Voir les records',
    href: '/records',
  });

  if (input.programId) {
    actions.push({
      type: 'VIEW_PROGRAM',
      label: 'Voir le programme',
      href: `/programs/${encodeURIComponent(input.programId)}`,
    });
  }

  // Dédupliquer par type en gardant le premier.
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.type)) return false;
    seen.add(action.type);
    return true;
  });
}

/**
 * Indique une progression récente significative à partir des résumés déjà calculés.
 * Ne recalcule pas e1RM / plateau — lit uniquement des flags/trends fournis.
 */
export function inferSignificantRecentProgress(input: {
  plateauStatus: string | null;
  plateauReasons: string[];
  maxWeightChangeKg: number | null;
  maxRepsChange: number | null;
  e1rmChangePercent: number | null;
}): boolean {
  if (input.plateauReasons.includes('RECENT_PROGRESS_DETECTED')) {
    return true;
  }
  if (input.plateauStatus === 'NONE') {
    if (input.maxWeightChangeKg != null && input.maxWeightChangeKg >= 1) {
      return true;
    }
    if (input.maxRepsChange != null && input.maxRepsChange > 0) {
      return true;
    }
    if (input.e1rmChangePercent != null && input.e1rmChangePercent >= 1) {
      return true;
    }
  }
  return false;
}

const emptyQueryToUndefined = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

export const exerciseCoachSummaryQuerySchema = z
  .object({
    equipmentId: z.preprocess(
      emptyQueryToUndefined,
      z.string().uuid().optional(),
    ),
    from: z.preprocess(emptyQueryToUndefined, z.string().optional()),
    to: z.preprocess(emptyQueryToUndefined, z.string().optional()),
  })
  .strict();

export type ExerciseCoachSummaryQuery = z.infer<
  typeof exerciseCoachSummaryQuerySchema
>;
