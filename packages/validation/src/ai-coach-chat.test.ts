import { describe, expect, it } from 'vitest';
import {
  AI_COACH_MAX_TOOL_CALLS_PER_TURN,
  AI_COACH_READ_ONLY_TOOL_NAMES,
  AI_COACH_TOOL_DEFINITIONS,
  assertReadOnlyToolRegistry,
  buildAiCoachHistoryAssistantWireContent,
  buildAiCoachInstructions,
  filterAiCoachFollowUps,
  isAiCoachMutationFollowUp,
  parseAiCoachChatAnswer,
  searchExercisesToolArgsSchema,
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
    const cmd = '11111111-1111-1111-1111-111111111111';
    expect(
      sendAiCoachMessageBodySchema.parse({
        content: '  Bonjour  ',
        clientCommandId: cmd,
      }).content,
    ).toBe('Bonjour');
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: 'Est-ce que je progresse aux tractions ?',
        clientCommandId: cmd,
      }).success,
    ).toBe(true);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: 'Propose-moi une séance dos de 45 minutes',
        clientCommandId: cmd,
      }).success,
    ).toBe(true);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: 'Propose-moi un programme upper/lower sur 4 jours',
        clientCommandId: cmd,
      }).success,
    ).toBe(true);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: '',
        clientCommandId: cmd,
      }).success,
    ).toBe(false);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: '   ',
        clientCommandId: cmd,
      }).success,
    ).toBe(false);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: 42,
        clientCommandId: cmd,
      }).success,
    ).toBe(false);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        clientCommandId: cmd,
      }).success,
    ).toBe(false);
    expect(
      sendAiCoachMessageBodySchema.safeParse({
        content: 'x'.repeat(1501),
        clientCommandId: cmd,
      }).success,
    ).toBe(false);
    // conversationId appartient à l’URL, pas au body (.strict)
    const leakedId = sendAiCoachMessageBodySchema.safeParse({
      conversationId: '11111111-1111-1111-1111-111111111111',
      content: 'Bonjour',
      clientCommandId: '22222222-2222-2222-2222-222222222222',
    });
    expect(leakedId.success).toBe(false);
    expect(leakedId.success ? null : leakedId.error.issues[0]?.code).toBe(
      'unrecognized_keys',
    );
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

  it('valide search_exercises : labels + au moins un critère', () => {
    expect(
      searchExercisesToolArgsSchema.safeParse({ muscleGroup: 'Dos' }).success,
    ).toBe(true);
    expect(
      searchExercisesToolArgsSchema.safeParse({
        query: 'tractions',
        limit: 12,
      }).success,
    ).toBe(true);
    expect(
      searchExercisesToolArgsSchema.safeParse({
        equipmentType: 'Haltères',
      }).success,
    ).toBe(true);
    expect(searchExercisesToolArgsSchema.safeParse({}).success).toBe(false);
    expect(
      searchExercisesToolArgsSchema.safeParse({ limit: 5 }).success,
    ).toBe(false);
    const def = AI_COACH_TOOL_DEFINITIONS.find(
      (tool) => tool.name === 'search_exercises',
    );
    expect(def?.parameters.properties).toHaveProperty('muscleGroup');
    expect(def?.parameters.properties).toHaveProperty('equipmentType');
  });

  it('rejoue l’historique assistant en wire JSON (TURN 2 Structured Outputs)', () => {
    const wire = JSON.parse(
      buildAiCoachHistoryAssistantWireContent('Bonjour !'),
    ) as { t: string; x: string; d: null };
    expect(wire).toEqual({
      t: 'd',
      x: 'Bonjour !',
      d: null,
      rf: [],
      fu: [],
    });
    const proposalWire = JSON.parse(
      buildAiCoachHistoryAssistantWireContent('Séance dos.', 'WORKOUT'),
    ) as { t: string; d: { k: string } };
    expect(proposalWire.t).toBe('p');
    expect(proposalWire.d.k).toBe('wk');
    expect(buildAiCoachInstructions()).toContain('search_exercises');
  });
});
