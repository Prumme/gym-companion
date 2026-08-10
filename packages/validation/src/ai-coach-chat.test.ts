import { describe, expect, it } from 'vitest';
import {
  AI_COACH_MAX_TOOL_CALLS_PER_TURN,
  AI_COACH_READ_ONLY_TOOL_NAMES,
  assertReadOnlyToolRegistry,
  parseAiCoachChatAnswer,
  sendAiCoachMessageBodySchema,
} from './ai-coach-chat';

describe('ai-coach-chat (5.6)', () => {
  it('registre lecture seule sans outil de mutation', () => {
    expect(() =>
      assertReadOnlyToolRegistry(AI_COACH_READ_ONLY_TOOL_NAMES),
    ).not.toThrow();
    expect(AI_COACH_READ_ONLY_TOOL_NAMES.every((name) => name.startsWith('get_'))).toBe(
      true,
    );
    expect(AI_COACH_MAX_TOOL_CALLS_PER_TURN).toBe(4);
  });

  it('refuse un outil d’écriture dans le registre', () => {
    expect(() =>
      assertReadOnlyToolRegistry(['get_personal_records', 'apply_load']),
    ).toThrow(/Unknown AI coach tool|Forbidden/);
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

  it('valide la réponse chat structurée', () => {
    const answer = parseAiCoachChatAnswer({
      message: 'Tu n’as pas encore de record.',
      references: [],
      suggestedFollowUps: ['Voir ma progression'],
    });
    expect(answer.message).toContain('record');
    expect(() =>
      parseAiCoachChatAnswer({
        message: 'x'.repeat(2000),
        references: [],
        suggestedFollowUps: [],
      }),
    ).toThrow();
  });
});
