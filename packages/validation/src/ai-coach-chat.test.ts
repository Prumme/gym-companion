import { describe, expect, it } from 'vitest';
import {
  AI_COACH_MAX_TOOL_CALLS_PER_TURN,
  AI_COACH_READ_ONLY_TOOL_NAMES,
  AI_COACH_TOOL_DEFINITIONS,
  assertReadOnlyToolRegistry,
  filterAiCoachFollowUps,
  isAiCoachMutationFollowUp,
  parseAiCoachChatAnswer,
  sendAiCoachMessageBodySchema,
} from './ai-coach-chat';

describe('ai-coach-chat (5.6 + jalon 8 structuré)', () => {
  it('registre lecture seule sans outil de mutation', () => {
    expect(() =>
      assertReadOnlyToolRegistry(AI_COACH_READ_ONLY_TOOL_NAMES),
    ).not.toThrow();
    expect(AI_COACH_READ_ONLY_TOOL_NAMES.every((name) => name.startsWith('get_') || name === 'search_exercises')).toBe(
      true,
    );
    expect(AI_COACH_MAX_TOOL_CALLS_PER_TURN).toBe(4);
  });

  it('inclut les outils jalon 8 (search_exercises, get_active_program, get_program_detail)', () => {
    expect(AI_COACH_READ_ONLY_TOOL_NAMES).toContain('search_exercises');
    expect(AI_COACH_READ_ONLY_TOOL_NAMES).toContain('get_active_program');
    expect(AI_COACH_READ_ONLY_TOOL_NAMES).toContain('get_program_detail');
    const names = AI_COACH_TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toEqual([...AI_COACH_READ_ONLY_TOOL_NAMES]);
  });

  it('refuse un outil d’écriture dans le registre', () => {
    expect(() =>
      assertReadOnlyToolRegistry(['get_personal_records', 'apply_load']),
    ).toThrow(/Unknown AI coach tool|Forbidden/);
  });

  it('refuse un outil "search_web" (distinct de search_exercises)', () => {
    expect(() =>
      assertReadOnlyToolRegistry(['search_web']),
    ).toThrow(/Unknown AI coach tool/);
  });

  it('valide le message utilisateur', () => {
    expect(
      sendAiCoachMessageBodySchema.parse({
        content: '  Bonjour  ',
        clientCommandId: '11111111-1111-1111-1111-111111111111',
      }).content,
    ).toBe('Bonjour');
    expect(() =>
      sendAiCoachMessageBodySchema.parse({
        content: '',
        clientCommandId: '11111111-1111-1111-1111-111111111111',
      }),
    ).toThrow();
  });

  it('valide une réponse chat structurée discussion', () => {
    const answer = parseAiCoachChatAnswer({
      type: 'discussion',
      text: 'Tu n’as pas encore de record.',
      data: null,
      references: [],
      suggestedFollowUps: ['Voir ma progression'],
    });
    expect(answer.text).toContain('record');
    expect(answer.type).toBe('discussion');
    expect(() =>
      parseAiCoachChatAnswer({
        type: 'discussion',
        text: 'x'.repeat(2000),
        data: null,
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('valide une réponse chat structurée proposal', () => {
    const answer = parseAiCoachChatAnswer({
      type: 'proposal',
      text: 'Voici une séance adaptée.',
      data: {
        kind: 'workout',
        workout: {
          name: 'Push A',
          estimatedDurationMinutes: 45,
          exercises: [
            {
              exerciseId: '11111111-1111-1111-1111-111111111111',
              equipmentTypeId: null,
              notes: null,
              sets: [
                {
                  setType: 'WORKING',
                  targetRepMin: 8,
                  targetRepMax: 10,
                  targetDurationSeconds: null,
                  targetDistanceMeters: null,
                  targetWeightKg: 60,
                  targetIntensityPercent: null,
                  targetRir: 2,
                  targetRpe: null,
                  restSeconds: 90,
                },
              ],
            },
          ],
        },
        program: null,
      },
      references: [],
      suggestedFollowUps: [],
    });
    expect(answer.type).toBe('proposal');
    expect(answer.data?.kind).toBe('workout');
  });

  it('refuse une proposal sans data', () => {
    expect(() =>
      parseAiCoachChatAnswer({
        type: 'proposal',
        text: 'x',
        data: null,
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });

  it('filtre les follow-ups mutationnels évidents', () => {
    const mutationals = [
      'Applique 85 kg',
      'Modifie mon programme',
      'Supprime cet exercice',
      'Change ma charge à 90 kg',
    ];
    for (const text of mutationals) {
      expect(isAiCoachMutationFollowUp(text)).toBe(true);
    }
    const kept = filterAiCoachFollowUps([
      ...mutationals,
      'Pourquoi cette charge est-elle recommandée ?',
      'Montre-moi ma progression.',
      'Quels sont mes records ?',
    ]);
    expect(kept).toEqual([
      'Pourquoi cette charge est-elle recommandée ?',
      'Montre-moi ma progression.',
      'Quels sont mes records ?',
    ]);
  });
});
