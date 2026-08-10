import {
  AI_COACH_SYSTEM_INSTRUCTIONS,
  buildAiCoachUserMessage,
  parseAiCoachExplanationResult,
  type AiCoachExplanationResult,
} from '@gym-companion/validation';

import {
  AiCoachProviderError,
  type AiCoachProvider,
  type AiCoachProviderRequest,
} from './ai-coach-provider';

/**
 * Provider OpenAI via Chat Completions + JSON object.
 * Aucun SDK — fetch natif uniquement côté API.
 */
export class OpenAiCoachProvider implements AiCoachProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.openai.com/v1',
  ) {}

  async explainExerciseCoachSummary(
    request: AiCoachProviderRequest,
  ): Promise<AiCoachExplanationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: AI_COACH_SYSTEM_INSTRUCTIONS },
            {
              role: 'user',
              content: buildAiCoachUserMessage(request.input),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new AiCoachProviderError(
          'AI_COACH_RATE_LIMITED',
          'Le fournisseur IA a limité le débit.',
        );
      }

      if (!response.ok) {
        throw new AiCoachProviderError(
          'AI_COACH_UNAVAILABLE',
          `Fournisseur IA indisponible (${response.status}).`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new AiCoachProviderError(
          'AI_COACH_INVALID_RESPONSE',
          'Réponse fournisseur vide.',
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (cause) {
        throw new AiCoachProviderError(
          'AI_COACH_INVALID_RESPONSE',
          'Réponse fournisseur non JSON.',
          { cause },
        );
      }

      try {
        return parseAiCoachExplanationResult(parsed);
      } catch (cause) {
        throw new AiCoachProviderError(
          'AI_COACH_INVALID_RESPONSE',
          'Réponse fournisseur hors schéma.',
          { cause },
        );
      }
    } catch (error) {
      if (error instanceof AiCoachProviderError) throw error;
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        throw new AiCoachProviderError(
          'AI_COACH_TIMEOUT',
          'Délai d’attente du fournisseur IA dépassé.',
          { cause: error },
        );
      }
      throw new AiCoachProviderError(
        'AI_COACH_UNAVAILABLE',
        'Fournisseur IA indisponible.',
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
