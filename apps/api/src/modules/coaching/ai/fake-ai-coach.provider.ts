import type {
  AiCoachExplanationInput,
  AiCoachExplanationResult,
} from '@gym-companion/validation';

import {
  AiCoachProviderError,
  type AiCoachProvider,
  type AiCoachProviderRequest,
} from './ai-coach-provider';

export type FakeAiCoachBehavior =
  | { mode: 'success'; result?: Partial<AiCoachExplanationResult> }
  | { mode: 'invalid' }
  | { mode: 'timeout' }
  | { mode: 'unavailable' }
  | { mode: 'rate_limited' };

/**
 * Provider factice pour tests uniquement.
 * Ne doit jamais être activé silencieusement en production.
 */
export class FakeAiCoachProvider implements AiCoachProvider {
  readonly name = 'fake';

  lastInput: AiCoachExplanationInput | null = null;
  callCount = 0;
  behavior: FakeAiCoachBehavior = { mode: 'success' };

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
}
