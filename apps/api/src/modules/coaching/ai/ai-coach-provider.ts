import type {
  AiCoachChatAnswer,
  AiCoachExplanationInput,
  AiCoachExplanationResult,
  AiCoachConversationTurnInput,
  AiCoachConversationTurnResult,
  AiCoachToolDefinition,
} from '@gym-companion/validation';

export const AI_COACH_PROVIDER = Symbol('AI_COACH_PROVIDER');

export type AiCoachFailurePhase =
  | 'build_request'
  | 'openai_request'
  | 'tool_call'
  | 'tool_output'
  | 'structured_output'
  | 'wire_validation'
  | 'wire_mapping'
  | 'canonical_validation'
  | 'incomplete_output'
  | 'parse_response'
  | 'persistence';

export type AiCoachProviderRequest = {
  input: AiCoachExplanationInput;
  timeoutMs: number;
  model: string;
};

/** Items Responses API réinjectés entre tours d’outils. */
export type AiCoachResponsesToolLoopItem =
  | {
      type: 'function_call';
      id?: string;
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: 'function_call_output';
      call_id: string;
      output: string;
    };

export type AiCoachConversationProviderRequest = {
  input: AiCoachConversationTurnInput;
  tools: AiCoachToolDefinition[];
  timeoutMs: number;
  model: string;
  pendingToolLoop?: AiCoachResponsesToolLoopItem[];
  forceFinalAnswer?: boolean;
  /** Compact machine feedback for one bounded proposal repair attempt. */
  repairFeedback?: string;
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
  readonly phase: AiCoachFailurePhase | null;
  readonly httpStatus: number | null;
  readonly providerCode: string | null;
  readonly providerType: string | null;
  readonly openaiRequestId: string | null;
  readonly model: string | null;

  constructor(
    readonly code:
      | 'AI_COACH_TIMEOUT'
      | 'AI_COACH_RATE_LIMITED'
      | 'AI_COACH_UNAVAILABLE'
      | 'AI_COACH_INVALID_RESPONSE',
    message: string,
    options?: {
      cause?: unknown;
      phase?: AiCoachFailurePhase;
      httpStatus?: number | null;
      providerCode?: string | null;
      providerType?: string | null;
      openaiRequestId?: string | null;
      model?: string | null;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AiCoachProviderError';
    this.phase = options?.phase ?? null;
    this.httpStatus = options?.httpStatus ?? null;
    this.providerCode = options?.providerCode ?? null;
    this.providerType = options?.providerType ?? null;
    this.openaiRequestId = options?.openaiRequestId ?? null;
    this.model = options?.model ?? null;
  }
}

export type { AiCoachChatAnswer };
