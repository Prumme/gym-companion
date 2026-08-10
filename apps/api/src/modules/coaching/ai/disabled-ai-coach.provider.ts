import {
  AiCoachProviderError,
  type AiCoachConversationProviderRequest,
  type AiCoachProvider,
  type AiCoachProviderRequest,
} from './ai-coach-provider';

/** Provider no-op lorsque l’IA est désactivée ou mal configurée. */
export class DisabledAiCoachProvider implements AiCoachProvider {
  readonly name = 'disabled';

  async explainExerciseCoachSummary(
    _request: AiCoachProviderRequest,
  ): Promise<never> {
    throw new AiCoachProviderError(
      'AI_COACH_UNAVAILABLE',
      'Fournisseur IA non configuré.',
    );
  }

  async generateConversationTurn(
    _request: AiCoachConversationProviderRequest,
  ): Promise<never> {
    throw new AiCoachProviderError(
      'AI_COACH_UNAVAILABLE',
      'Fournisseur IA non configuré.',
    );
  }
}
