import { describe, expect, it } from 'vitest';

import {
  formatDecisionHistoryLine,
  formatEvidenceSummary,
  formatLoadWeightKg,
  formatLoadWeightTransition,
  getLoadRecommendationActionLabel,
  getLoadRecommendationDecisionLabel,
  getPrimaryLoadRecommendationMessage,
  isLoadRecommendationActionable,
} from '../lib/load-recommendation-labels';
import type { LoadRecommendation } from '@gym-companion/shared';

const sample: LoadRecommendation = {
  workoutTemplateExerciseId: 'wte-1',
  exerciseId: 'ex-1',
  supported: true,
  action: 'INCREASE',
  currentTarget: {
    weightKg: 80,
    minReps: 8,
    maxReps: 10,
    targetRir: null,
    targetRpe: null,
  },
  recommendation: {
    suggestedWeightKg: 82.5,
    adjustmentKg: 2.5,
    incrementKg: 2.5,
    incrementSource: 'SYSTEM_DEFAULT',
  },
  evidence: {
    workoutCount: 2,
    latestWorkoutDate: '2026-08-01',
    effortDataUsed: false,
    recentWorkouts: [],
  },
  reasons: ['TARGET_RANGE_REACHED'],
  engineVersion: 'LOAD_RECOMMENDATION_V1',
  recommendationFingerprint: 'fp-test',
};

describe('load-recommendation-labels (5.1 + 5.2)', () => {
  it('formate les poids et libellés de décision', () => {
    expect(formatLoadWeightKg(82.5)).toMatch(/82,5 kg/);
    expect(formatLoadWeightTransition(80, 82.5)).toMatch(
      /80\s*kg\s*→\s*82,5\s*kg/,
    );
    expect(getLoadRecommendationActionLabel('DECREASE')).toBe(
      'Réduire la charge',
    );
    expect(getLoadRecommendationDecisionLabel('ACCEPTED')).toBe('Acceptée');
    expect(getLoadRecommendationDecisionLabel('ADJUSTED')).toBe('Ajustée');
    expect(getLoadRecommendationDecisionLabel('IGNORED')).toBe('Ignorée');
    expect(isLoadRecommendationActionable('INCREASE')).toBe(true);
    expect(isLoadRecommendationActionable('REVIEW')).toBe(false);
    expect(getPrimaryLoadRecommendationMessage(sample)).toMatch(
      /haut de ta plage/i,
    );
    expect(formatEvidenceSummary(sample)).toBe(
      'Basé sur 2 séances récentes.',
    );
    expect(
      formatDecisionHistoryLine({
        recommendationAction: 'INCREASE',
        decisionType: 'ADJUSTED',
        currentTargetWeightKg: 80,
        recommendedWeightKg: 82.5,
        appliedWeightKg: 81.5,
      }),
    ).toMatch(/Ajustée à 81,5 kg/);
  });
});
