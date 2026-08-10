import type {
  AiCoachChatAnswer,
  AiCoachConversationTurnResult,
  AiCoachExplanationInput,
  AiCoachExplanationResult,
} from '@gym-companion/validation';

import {
  AiCoachProviderError,
  type AiCoachConversationProviderRequest,
  type AiCoachProvider,
  type AiCoachProviderRequest,
} from './ai-coach-provider';

export type FakeAiCoachBehavior =
  | { mode: 'success'; result?: Partial<AiCoachExplanationResult> }
  | { mode: 'invalid' }
  | { mode: 'timeout' }
  | { mode: 'unavailable' }
  | { mode: 'rate_limited' };

export type FakeChatBehavior =
  | { mode: 'answer'; answer: AiCoachChatAnswer }
  | {
      mode: 'tools_then_answer';
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
      answer: AiCoachChatAnswer;
    }
  | { mode: 'timeout' }
  | { mode: 'unavailable' }
  | { mode: 'invalid' };

/**
 * Provider factice pour tests uniquement.
 */
export class FakeAiCoachProvider implements AiCoachProvider {
  readonly name = 'fake';

  lastInput: AiCoachExplanationInput | null = null;
  callCount = 0;
  behavior: FakeAiCoachBehavior = { mode: 'success' };

  chatCallCount = 0;
  chatBehavior: FakeChatBehavior = {
    mode: 'answer',
    answer: {
      message: 'Réponse de test.',
      references: [],
      suggestedFollowUps: [],
    },
  };
  lastChatRequest: AiCoachConversationProviderRequest | null = null;
  /** Délai artificiel (ms) avant chaque tour chat — tests concurrence. */
  chatDelayMs = 0;
  /** Nombre d’entrées dans generateConversationTurn (avant résolution). */
  chatEnterCount = 0;
  /** Bloque le tour jusqu’à `releaseChatGate()` (tests busy). */
  private chatGate: Promise<void> | null = null;
  private releaseChatGateFn: (() => void) | null = null;
  private chatPhase = 0;

  resetChat(): void {
    this.chatCallCount = 0;
    this.chatEnterCount = 0;
    this.chatPhase = 0;
    this.lastChatRequest = null;
    this.chatDelayMs = 0;
    this.chatGate = null;
    this.releaseChatGateFn = null;
  }

  armChatGate(): void {
    this.chatGate = new Promise((resolve) => {
      this.releaseChatGateFn = resolve;
    });
  }

  releaseChatGate(): void {
    this.releaseChatGateFn?.();
    this.chatGate = null;
    this.releaseChatGateFn = null;
  }

  async explainExerciseCoachSummary(
    request: AiCoachProviderRequest,
  ): Promise<AiCoachExplanationResult> {
    this.callCount += 1;
    this.lastInput = request.input;

    switch (this.behavior.mode) {
      case 'timeout':
        throw new AiCoachProviderError(
          'AI_COACH_TIMEOUT',
          'Délai d’attente du fournisseur IA dépassé.',
        );
      case 'unavailable':
        throw new AiCoachProviderError(
          'AI_COACH_UNAVAILABLE',
          'Fournisseur IA indisponible.',
        );
      case 'rate_limited':
        throw new AiCoachProviderError(
          'AI_COACH_RATE_LIMITED',
          'Le fournisseur IA a limité le débit.',
        );
      case 'invalid':
        throw new AiCoachProviderError(
          'AI_COACH_INVALID_RESPONSE',
          'Réponse fournisseur hors schéma.',
        );
      case 'success': {
        const action = request.input.loadRecommendation?.action ?? null;
        const plateau = request.input.plateau?.status ?? null;
        return {
          title: this.behavior.result?.title ?? 'Explication de test',
          summary:
            this.behavior.result?.summary ??
            `Statut ${request.input.coachStatus}. Action déterministe: ${action ?? 'aucune'}. Plateau: ${plateau ?? 'aucun'}.`,
          keyPoints: this.behavior.result?.keyPoints ?? [
            'Les faits métier fournis restent la source de vérité.',
          ],
          caution: this.behavior.result?.caution ?? null,
        };
      }
      default: {
        const _exhaustive: never = this.behavior;
        throw new Error(`Unknown fake behavior: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  async generateConversationTurn(
    request: AiCoachConversationProviderRequest,
  ): Promise<AiCoachConversationTurnResult> {
    this.chatEnterCount += 1;
    if (this.chatGate) {
      await this.chatGate;
    }
    if (this.chatDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.chatDelayMs));
    }
    this.chatCallCount += 1;
    this.lastChatRequest = request;

    switch (this.chatBehavior.mode) {
      case 'timeout':
        throw new AiCoachProviderError(
          'AI_COACH_TIMEOUT',
          'Délai d’attente du fournisseur IA dépassé.',
        );
      case 'unavailable':
        throw new AiCoachProviderError(
          'AI_COACH_UNAVAILABLE',
          'Fournisseur IA indisponible.',
        );
      case 'invalid':
        throw new AiCoachProviderError(
          'AI_COACH_INVALID_RESPONSE',
          'Réponse chat hors schéma.',
        );
      case 'answer':
        return {
          kind: 'answer',
          answer: this.chatBehavior.answer,
          providerRequestId: 'fake-req',
        };
      case 'tools_then_answer': {
        if (request.forceFinalAnswer || this.chatPhase > 0) {
          return {
            kind: 'answer',
            answer: this.chatBehavior.answer,
            providerRequestId: 'fake-req-final',
          };
        }
        this.chatPhase += 1;
        return {
          kind: 'tool_calls',
          toolCalls: this.chatBehavior.toolCalls.map((call, index) => ({
            id: `tool-${index}`,
            name: call.name,
            argumentsJson: JSON.stringify(call.arguments),
          })),
          providerRequestId: 'fake-req-tools',
          assistantContent: null,
        };
      }
      default: {
        const _exhaustive: never = this.chatBehavior;
        throw new Error(`Unknown chat behavior: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
