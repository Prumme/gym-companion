import type {
  AiCoachChatAnswer,
  AiCoachExplanationInput,
  AiCoachExplanationResult,
  AiCoachConversationTurnInput,
  AiCoachConversationTurnResult,
  AiCoachToolDefinition,
} from '@gym-companion/validation';

export const AI_COACH_PROVIDER = Symbol('AI_COACH_PROVIDER');

export type AiCoachProviderRequest = {
  input: AiCoachExplanationInput;
  timeoutMs: number;
  model: string;
};

export type AiCoachConversationProviderRequest = {
  input: AiCoachConversationTurnInput;
  tools: AiCoachToolDefinition[];
  timeoutMs: number;
  model: string;
  pendingToolLoop?: Array<
    | {
        role: 'assistant';
        content: string | null;
        tool_calls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }>;
      }
    | { role: 'tool'; tool_call_id: string; content: string }
  >;
  forceFinalAnswer?: boolean;
};

export interface AiCoachProvider {
  readonly name: string;

  explainExerciseCoachSummary(
    request: AiCoachProviderRequest,
  ): Promise<AiCoachExplanationResult>;

  generateConversationTurn(
    request: AiCoachConversationProviderRequest,
  ): Promise<AiCoachConversationTurnResult>;
}

export class AiCoachProviderError extends Error {
  constructor(
    readonly code:
      | 'AI_COACH_TIMEOUT'
      | 'AI_COACH_RATE_LIMITED'
      | 'AI_COACH_UNAVAILABLE'
      | 'AI_COACH_INVALID_RESPONSE',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AiCoachProviderError';
  }
}

export type { AiCoachChatAnswer };
