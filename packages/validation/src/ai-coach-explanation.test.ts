import { describe, expect, it } from 'vitest';
import {
  AI_COACH_EXPLANATION_SCHEMA_VERSION,
  AI_COACH_PROMPT_VERSION,
  AI_COACH_SYSTEM_INSTRUCTIONS,
  assertAiCoachPayloadMinimized,
  buildAiCoachExplanationInput,
  buildAiCoachUserMessage,
  computeCoachSummaryFingerprint,
  generateExerciseCoachExplanationBodySchema,
  parseAiCoachExplanationResult,
  resolveAvailableAiCoachFocuses,
} from './ai-coach-explanation';

describe('ai-coach-explanation (5.5)', () => {
  const baseArgs = {
    exerciseName: 'Développé couché',
    measurementType: 'WEIGHT_REPS',
    coachStatus: 'WATCH',
    loadRecommendation: {
      action: 'HOLD',
      currentWeightKg: 80,
      suggestedWeightKg: 80,
      reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
    },
    plateau: {
      status: 'WATCH',
      reasons: ['LOAD_NOT_INCREASING'],
      analyzedWorkoutCount: 3,
    },
    progress: {
      maxWeightKg: { first: 80, latest: 80 },
      maxReps: { first: 9, latest: 9 },
    },
    strength: {
      latestEstimatedOneRepMaxKg: 104,
      bestEstimatedOneRepMaxKg: 104,
      changeKg: 0,
      changePercent: 0,
    },
    recentDecision: null,
    notices: [{ code: 'EFFORT_DATA_MISSING', severity: 'INFO' as const }],
  };

  it('construit un payload GENERAL minimisé', () => {
    const input = buildAiCoachExplanationInput({
      ...baseArgs,
      focus: 'GENERAL',
    });
    expect(input.schemaVersion).toBe(AI_COACH_EXPLANATION_SCHEMA_VERSION);
    expect(input.locale).toBe('fr-FR');
    expect(input.loadRecommendation?.action).toBe('HOLD');
    expect(input.plateau?.status).toBe('WATCH');
    expect(input.progress?.maxWeightLatestKg).toBe(80);
    expect(input.notices).toEqual([
      { code: 'EFFORT_DATA_MISSING', severity: 'INFO' },
    ]);
    assertAiCoachPayloadMinimized(input);
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain('ownerUserId');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('JWT');
  });

  it('focus LOAD omet plateau/progress massifs', () => {
    const input = buildAiCoachExplanationInput({
      ...baseArgs,
      focus: 'LOAD',
    });
    expect(input.loadRecommendation?.action).toBe('HOLD');
    expect(input.plateau).toBeNull();
    expect(input.progress).toBeNull();
    expect(input.strength).toBeNull();
  });

  it('focus PROGRESS omet load', () => {
    const input = buildAiCoachExplanationInput({
      ...baseArgs,
      focus: 'PROGRESS',
    });
    expect(input.loadRecommendation).toBeNull();
    expect(input.progress?.maxWeightFirstKg).toBe(80);
    expect(input.strength?.latestEstimatedOneRepMaxKg).toBe(104);
  });

  it('focus PLATEAU conserve plateau + progress', () => {
    const input = buildAiCoachExplanationInput({
      ...baseArgs,
      focus: 'PLATEAU',
    });
    expect(input.plateau?.analyzedWorkoutCount).toBe(3);
    expect(input.loadRecommendation).toBeNull();
    expect(input.progress).not.toBeNull();
  });

  it('valide la sortie structurée et refuse les dépassements', () => {
    expect(
      parseAiCoachExplanationResult({
        title: 'Titre',
        summary: 'Résumé',
        keyPoints: ['a'],
        caution: null,
      }),
    ).toMatchObject({ title: 'Titre' });

    expect(() =>
      parseAiCoachExplanationResult({
        title: 'x'.repeat(81),
        summary: 'ok',
        keyPoints: [],
        caution: null,
      }),
    ).toThrow();

    expect(() =>
      parseAiCoachExplanationResult({
        title: 'ok',
        summary: 'ok',
        keyPoints: ['1', '2', '3', '4', '5'],
        caution: null,
      }),
    ).toThrow();

    expect(() =>
      parseAiCoachExplanationResult({
        title: 'ok',
        summary: 'ok',
        keyPoints: [],
        caution: null,
        suggestedWeight: 90,
      }),
    ).toThrow();
  });

  it('fingerprint est stable et sensible au statut', () => {
    const source = {
      schemaVersion: AI_COACH_EXPLANATION_SCHEMA_VERSION,
      exerciseId: 'ex-1',
      measurementType: 'WEIGHT_REPS',
      status: 'WATCH',
      loadRecommendation: {
        action: 'HOLD',
        currentWeightKg: 80,
        suggestedWeightKg: 80,
        reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
      },
      plateau: {
        status: 'WATCH',
        reasons: ['LOAD_NOT_INCREASING'],
        analyzedWorkoutCount: 3,
      },
      progress: null,
      strength: null,
      recentDecision: null,
      notices: [],
      generatedFrom: { latestWorkoutDate: '2026-08-03', workoutCount: 3 },
    };
    const a = computeCoachSummaryFingerprint(source);
    const b = computeCoachSummaryFingerprint(source);
    expect(a).toBe(b);
    const c = computeCoachSummaryFingerprint({ ...source, status: 'PLATEAU' });
    expect(c).not.toBe(a);
  });

  it('messages provider séparent instructions et données', () => {
    const input = buildAiCoachExplanationInput({
      ...baseArgs,
      focus: 'GENERAL',
    });
    expect(AI_COACH_SYSTEM_INSTRUCTIONS).toContain('autoritatifs');
    expect(AI_COACH_SYSTEM_INSTRUCTIONS).not.toContain('Développé couché');
    const userMessage = buildAiCoachUserMessage(input);
    expect(userMessage).toContain('Données structurées');
    expect(userMessage).toContain('"schemaVersion"');
    expect(AI_COACH_PROMPT_VERSION).toBe('AI_COACH_PROMPT_V1');
  });

  it('body client minimal', () => {
    expect(generateExerciseCoachExplanationBodySchema.parse({})).toEqual({
      focus: 'GENERAL',
    });
    expect(
      generateExerciseCoachExplanationBodySchema.parse({ focus: 'LOAD' }),
    ).toEqual({ focus: 'LOAD' });
    expect(() =>
      generateExerciseCoachExplanationBodySchema.parse({
        focus: 'LOAD',
        weightKg: 80,
      }),
    ).toThrow();
  });

  it('focus UI disponibles selon données', () => {
    expect(
      resolveAvailableAiCoachFocuses({
        hasLoadRecommendation: true,
        hasProgress: true,
        hasPlateauSignal: false,
      }),
    ).toEqual(['GENERAL', 'LOAD', 'PROGRESS']);
  });
});
