import type {
  AiCoachExplanationInput,
  AiCoachExplanationResult,
} from '@gym-companion/validation';

export const AI_COACH_PROVIDER = Symbol('AI_COACH_PROVIDER');

export type AiCoachProviderRequest = {
  input: AiCoachExplanationInput;
  timeoutMs: number;
  model: string;
};

export interface AiCoachProvider {
  readonly name: string;

  explainExerciseCoachSummary(
    request: AiCoachProviderRequest,
  ): Promise<AiCoachExplanationResult>;
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
