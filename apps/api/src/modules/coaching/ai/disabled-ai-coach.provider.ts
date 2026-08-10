import { AiCoachProviderError, type AiCoachProvider } from './ai-coach-provider';

/** Provider no-op lorsque l’IA est désactivée ou mal configurée. */
export class DisabledAiCoachProvider implements AiCoachProvider {
  readonly name = 'disabled';

  async explainExerciseCoachSummary(): Promise<never> {
    throw new AiCoachProviderError(
      'AI_COACH_UNAVAILABLE',
      'Fournisseur IA non configuré.',
    );
  }
}
