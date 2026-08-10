import { describe, expect, it } from 'vitest';

import {
  buildExerciseCoachActions,
  buildExerciseCoachNotices,
  compareExerciseCoachStatusPriority,
  inferSignificantRecentProgress,
  resolveExerciseCoachHeadline,
  resolveExerciseCoachStatus,
} from './exercise-coach';

describe('resolveExerciseCoachStatus', () => {
  it('NO_DATA sans historique', () => {
    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: false,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: null,
        loadRecommendationAction: null,
        hasSignificantRecentProgress: false,
        hasSufficientHistory: false,
      }),
    ).toBe('NO_DATA');
  });

  it('BUILDING_HISTORY avec peu de séances', () => {
    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'INSUFFICIENT_DATA',
        loadRecommendationAction: 'INSUFFICIENT_DATA',
        hasSignificantRecentProgress: false,
        hasSufficientHistory: false,
      }),
    ).toBe('BUILDING_HISTORY');
  });

  it('priorités REVIEW > PLATEAU > WATCH > PROGRESSING > STABLE', () => {
    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'PLATEAU',
        loadRecommendationAction: 'REVIEW',
        hasSignificantRecentProgress: true,
        hasSufficientHistory: true,
      }),
    ).toBe('REVIEW');

    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'PLATEAU',
        loadRecommendationAction: 'INCREASE',
        hasSignificantRecentProgress: false,
        hasSufficientHistory: true,
      }),
    ).toBe('PLATEAU');

    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'WATCH',
        loadRecommendationAction: 'HOLD',
        hasSignificantRecentProgress: false,
        hasSufficientHistory: true,
      }),
    ).toBe('WATCH');

    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'NONE',
        loadRecommendationAction: 'HOLD',
        hasSignificantRecentProgress: true,
        hasSufficientHistory: true,
      }),
    ).toBe('PROGRESSING');

    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'NONE',
        loadRecommendationAction: 'HOLD',
        hasSignificantRecentProgress: false,
        hasSufficientHistory: true,
      }),
    ).toBe('STABLE');
  });

  it('HOLD seul ne devient pas WATCH', () => {
    expect(
      resolveExerciseCoachStatus({
        hasCompletedHistory: true,
        measurementType: 'WEIGHT_REPS',
        plateauStatus: 'NONE',
        loadRecommendationAction: 'HOLD',
        hasSignificantRecentProgress: false,
        hasSufficientHistory: true,
      }),
    ).toBe('STABLE');
  });
});

describe('headlines / notices / actions', () => {
  it('headlines déterministes', () => {
    expect(resolveExerciseCoachHeadline('PLATEAU').title).toBe(
      'Stagnation détectée',
    );
    expect(resolveExerciseCoachHeadline('WATCH').title).toBe(
      'Progression à surveiller',
    );
  });

  it('notices équipement et effort', () => {
    const notices = buildExerciseCoachNotices({
      plateauStatus: 'REVIEW',
      plateauReasons: ['INCONSISTENT_EQUIPMENT'],
      loadRecommendationAction: 'HOLD',
      loadRecommendationReasons: ['INSUFFICIENT_EFFORT_DATA'],
      effortDataMissing: false,
    });
    expect(notices.map((n) => n.code)).toEqual([
      'MIXED_EQUIPMENT',
      'EFFORT_DATA_MISSING',
    ]);
  });

  it('actions sans mutation', () => {
    const actions = buildExerciseCoachActions({
      exerciseId: 'ex-1',
      programId: 'prog-1',
      hasActionableLoadRecommendation: true,
      hasProgress: true,
    });
    expect(actions[0]?.type).toBe('VIEW_LOAD_RECOMMENDATION');
    expect(actions.every((a) => a.href.startsWith('/'))).toBe(true);
  });

  it('ordre overview', () => {
    // compare(a,b) < 0 ⇒ a avant b (priorité plus haute)
    expect(compareExerciseCoachStatusPriority('REVIEW', 'PLATEAU')).toBeLessThan(
      0,
    );
    expect(
      compareExerciseCoachStatusPriority('WATCH', 'PROGRESSING'),
    ).toBeLessThan(0);
  });

  it('infère progression récente', () => {
    expect(
      inferSignificantRecentProgress({
        plateauStatus: 'NONE',
        plateauReasons: ['RECENT_PROGRESS_DETECTED'],
        maxWeightChangeKg: 0,
        maxRepsChange: 0,
        e1rmChangePercent: 0,
      }),
    ).toBe(true);
    expect(
      inferSignificantRecentProgress({
        plateauStatus: 'NONE',
        plateauReasons: [],
        maxWeightChangeKg: 2.5,
        maxRepsChange: 0,
        e1rmChangePercent: 0,
      }),
    ).toBe(true);
  });
});
