import { describe, expect, it } from 'vitest';
import {
  AI_COACH_PROPOSAL_TEXT_MAX,
  acceptCoachProposalBodySchema,
  coachStructuredResponseSchema,
  normalizeProposalText,
  parseCoachStructuredResponse,
} from './ai-coach-structured';

const EXERCISE_ID = '11111111-1111-1111-1111-111111111111';

function buildValidSet() {
  return {
    setType: 'WORKING' as const,
    targetRepMin: 8,
    targetRepMax: 10,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetWeightKg: 60,
    targetIntensityPercent: null,
    targetRir: 2,
    targetRpe: null,
    restSeconds: 90,
  };
}

function buildValidWorkout() {
  return {
    name: 'Push A',
    estimatedDurationMinutes: 45,
    exercises: [
      {
        exerciseId: EXERCISE_ID,
        equipmentTypeId: null,
        notes: null,
        sets: [buildValidSet()],
      },
    ],
  };
}

describe('ai-coach-structured', () => {
  it('valide une discussion sans data', () => {
    const parsed = parseCoachStructuredResponse({
      type: 'discussion',
      text: 'Voici une explication.',
      data: null,
      references: [],
      suggestedFollowUps: [],
    });
    expect(parsed.type).toBe('discussion');
  });

  it('refuse une discussion avec data non nul', () => {
    expect(() =>
      parseCoachStructuredResponse({
        type: 'discussion',
        text: 'x',
        data: { kind: 'none', workout: null, program: null },
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('valide une proposal workout', () => {
    const parsed = parseCoachStructuredResponse({
      type: 'proposal',
      text: 'Voici une séance adaptée.',
      data: { kind: 'workout', workout: buildValidWorkout(), program: null },
      references: [],
      suggestedFollowUps: [],
    });
    expect(parsed.data?.kind).toBe('workout');
    expect(parsed.data?.workout?.exercises).toHaveLength(1);
  });

  it('refuse une proposal workout avec data.program non nul', () => {
    expect(() =>
      parseCoachStructuredResponse({
        type: 'proposal',
        text: 'x',
        data: {
          kind: 'workout',
          workout: buildValidWorkout(),
          program: {
            name: 'P',
            description: null,
            goal: 'STRENGTH',
            workouts: [buildValidWorkout()],
            schedule: null,
          },
        },
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('refuse une proposal sans data', () => {
    expect(() =>
      parseCoachStructuredResponse({
        type: 'proposal',
        text: 'x',
        data: null,
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('refuse un texte de proposal trop long', () => {
    expect(() =>
      parseCoachStructuredResponse({
        type: 'proposal',
        text: 'x'.repeat(AI_COACH_PROPOSAL_TEXT_MAX + 1),
        data: { kind: 'workout', workout: buildValidWorkout(), program: null },
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('valide une proposal program avec schedule cohérent', () => {
    const parsed = parseCoachStructuredResponse({
      type: 'proposal',
      text: 'Programme force sur 2 séances.',
      data: {
        kind: 'program',
        workout: null,
        program: {
          name: 'Force 2x/sem',
          description: null,
          goal: 'STRENGTH',
          workouts: [buildValidWorkout(), buildValidWorkout()],
          schedule: [
            { weekday: 'MONDAY', workoutIndex: 0, position: 0 },
            { weekday: 'THURSDAY', workoutIndex: 1, position: 0 },
          ],
        },
      },
      references: [],
      suggestedFollowUps: [],
    });
    expect(parsed.data?.program?.workouts).toHaveLength(2);
  });

  it('refuse un schedule avec workoutIndex hors bornes', () => {
    expect(() =>
      parseCoachStructuredResponse({
        type: 'proposal',
        text: 'Programme',
        data: {
          kind: 'program',
          workout: null,
          program: {
            name: 'Force',
            description: null,
            goal: 'STRENGTH',
            workouts: [buildValidWorkout()],
            schedule: [{ weekday: 'MONDAY', workoutIndex: 5, position: 0 }],
          },
        },
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('refuse RIR et RPE simultanés sur une série', () => {
    const result = coachStructuredResponseSchema.safeParse({
      type: 'proposal',
      text: 'x',
      data: {
        kind: 'workout',
        workout: {
          ...buildValidWorkout(),
          exercises: [
            {
              exerciseId: EXERCISE_ID,
              equipmentTypeId: null,
              notes: null,
              sets: [{ ...buildValidSet(), targetRir: 2, targetRpe: 8 }],
            },
          ],
        },
        program: null,
      },
      references: [],
      suggestedFollowUps: [],
    });
    expect(result.success).toBe(false);
  });

  it('refuse une plage de répétitions invalide', () => {
    const result = coachStructuredResponseSchema.safeParse({
      type: 'proposal',
      text: 'x',
      data: {
        kind: 'workout',
        workout: {
          ...buildValidWorkout(),
          exercises: [
            {
              exerciseId: EXERCISE_ID,
              equipmentTypeId: null,
              notes: null,
              sets: [{ ...buildValidSet(), targetRepMin: 12, targetRepMax: 8 }],
            },
          ],
        },
        program: null,
      },
      references: [],
      suggestedFollowUps: [],
    });
    expect(result.success).toBe(false);
  });

  it('normalise un texte de proposal trop long avec ellipse', () => {
    const long = 'a'.repeat(AI_COACH_PROPOSAL_TEXT_MAX + 50);
    const normalized = normalizeProposalText(long);
    expect(normalized.length).toBe(AI_COACH_PROPOSAL_TEXT_MAX);
    expect(normalized.endsWith('…')).toBe(true);
  });

  it('accepte un accept body vide (kind program) ou avec programId (kind workout)', () => {
    expect(acceptCoachProposalBodySchema.parse({})).toEqual({});
    expect(
      acceptCoachProposalBodySchema.parse({ programId: EXERCISE_ID }),
    ).toEqual({ programId: EXERCISE_ID });
    expect(() =>
      acceptCoachProposalBodySchema.parse({ programId: 'not-a-uuid' }),
    ).toThrow();
  });
});
