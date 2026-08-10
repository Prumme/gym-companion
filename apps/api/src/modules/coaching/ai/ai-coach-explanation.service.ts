import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  ExerciseCoachExplanationResponse,
  ExerciseCoachSummary,
} from '@gym-companion/shared';
import {
  AI_COACH_EXPLANATION_SCHEMA_VERSION,
  AI_COACH_PROMPT_VERSION,
  assertAiCoachPayloadMinimized,
  buildAiCoachExplanationInput,
  generateExerciseCoachExplanationBodySchema,
  type AiCoachExplanationFocus,
} from '@gym-companion/validation';

import { AppConfigService } from '../../../config/app-config.service';
import { CoachSummaryService } from '../coach-summary.service';
import { AiCoachRateLimiter } from './ai-coach-rate-limiter';
import {
  AI_COACH_PROVIDER,
  AiCoachProviderError,
  type AiCoachProvider,
} from './ai-coach-provider';

@Injectable()
export class AiCoachExplanationService {
  private readonly logger = new Logger(AiCoachExplanationService.name);
  private readonly rateLimiter: AiCoachRateLimiter;

  constructor(
    private readonly config: AppConfigService,
    private readonly coachSummaryService: CoachSummaryService,
    @Inject(AI_COACH_PROVIDER) private readonly provider: AiCoachProvider,
  ) {
    this.rateLimiter = new AiCoachRateLimiter(
      this.config.aiCoachRateLimitPerMinute,
    );
  }

  isAvailable(): boolean {
    return this.config.aiCoachAvailable;
  }

  async generateExerciseExplanation(
    userId: string,
    exerciseId: string,
    body: unknown,
  ): Promise<ExerciseCoachExplanationResponse> {
    if (!this.config.aiCoachEnabled || !this.config.aiCoachAvailable) {
      throw new HttpException(
        {
          code: 'AI_COACH_DISABLED',
          message: 'Les explications IA ne sont pas activées.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!this.rateLimiter.tryConsume(userId)) {
      throw new HttpException(
        {
          code: 'AI_COACH_RATE_LIMITED',
          message: 'Trop de demandes d’explication IA. Réessaie plus tard.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const parsedBody = generateExerciseCoachExplanationBodySchema.safeParse(
      body ?? {},
    );
    if (!parsedBody.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Corps de requête invalide.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const focus = parsedBody.data.focus as AiCoachExplanationFocus;
    const startedAt = Date.now();

    const summary = await this.coachSummaryService.getExerciseCoachSummary(
      userId,
      exerciseId,
      {},
    );

    const llmInput = buildAiCoachExplanationInput({
      focus,
      exerciseName: summary.exercise.name,
      measurementType: summary.exercise.measurementType,
      coachStatus: summary.status,
      loadRecommendation: summary.loadRecommendation
        ? {
            action: summary.loadRecommendation.action,
            currentWeightKg: summary.loadRecommendation.currentWeightKg,
            suggestedWeightKg: summary.loadRecommendation.suggestedWeightKg,
            reasons: summary.loadRecommendation.reasons,
          }
        : null,
      plateau: summary.plateau
        ? {
            status: summary.plateau.status,
            reasons: summary.plateau.reasons,
            analyzedWorkoutCount: summary.plateau.analyzedWorkoutCount,
          }
        : null,
      progress: summary.progress,
      strength: summary.strength,
      recentDecision: summary.recentDecision
        ? {
            decisionType: summary.recentDecision.decisionType,
            recommendationAction: summary.recentDecision.recommendationAction,
            recommendedWeightKg: summary.recentDecision.recommendedWeightKg,
            appliedWeightKg: summary.recentDecision.appliedWeightKg,
          }
        : null,
      notices: summary.notices.map((notice) => ({
        code: notice.code,
        severity: notice.severity,
      })),
    });

    assertAiCoachPayloadMinimized(llmInput);

    try {
      const explanation = await this.provider.explainExerciseCoachSummary({
        input: llmInput,
        timeoutMs: this.config.aiCoachTimeoutMs,
        model: this.config.aiCoachModel,
      });

      this.logger.log({
        event: 'ai_coach_explanation',
        provider: this.provider.name,
        focus,
        success: true,
        durationMs: Date.now() - startedAt,
        exerciseId,
        userHash: hashUserId(userId),
        approxInputChars: JSON.stringify(llmInput).length,
        approxOutputChars: JSON.stringify(explanation).length,
      });

      return {
        explanation,
        meta: {
          schemaVersion: AI_COACH_EXPLANATION_SCHEMA_VERSION,
          promptVersion: AI_COACH_PROMPT_VERSION,
          focus,
          coachSummaryFingerprint: summary.coachSummaryFingerprint,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const code =
        error instanceof AiCoachProviderError
          ? error.code
          : 'AI_COACH_UNAVAILABLE';

      this.logger.warn({
        event: 'ai_coach_explanation',
        provider: this.provider.name,
        focus,
        success: false,
        durationMs: Date.now() - startedAt,
        exerciseId,
        userHash: hashUserId(userId),
        errorCode: code,
      });

      throw new HttpException(
        {
          code,
          message: mapAiErrorMessage(code),
        },
        mapAiHttpStatus(code),
      );
    }
  }

  /** Exposé pour tests de payload à partir d’un summary déjà chargé. */
  buildPayloadForSummary(
    summary: ExerciseCoachSummary,
    focus: AiCoachExplanationFocus,
  ) {
    return buildAiCoachExplanationInput({
      focus,
      exerciseName: summary.exercise.name,
      measurementType: summary.exercise.measurementType,
      coachStatus: summary.status,
      loadRecommendation: summary.loadRecommendation,
      plateau: summary.plateau,
      progress: summary.progress,
      strength: summary.strength,
      recentDecision: summary.recentDecision,
      notices: summary.notices,
    });
  }

  /** Test helper */
  getRateLimiterForTests(): AiCoachRateLimiter {
    return this.rateLimiter;
  }
}

function mapAiErrorMessage(code: string): string {
  switch (code) {
    case 'AI_COACH_TIMEOUT':
      return 'L’explication IA a pris trop de temps.';
    case 'AI_COACH_RATE_LIMITED':
      return 'Trop de demandes d’explication IA. Réessaie plus tard.';
    case 'AI_COACH_INVALID_RESPONSE':
      return 'L’explication IA n’est pas disponible pour le moment.';
    case 'AI_COACH_DISABLED':
      return 'Les explications IA ne sont pas activées.';
    default:
      return 'L’explication IA n’est pas disponible pour le moment.';
  }
}

function mapAiHttpStatus(code: string): HttpStatus {
  switch (code) {
    case 'AI_COACH_RATE_LIMITED':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'AI_COACH_DISABLED':
      return HttpStatus.SERVICE_UNAVAILABLE;
    case 'AI_COACH_TIMEOUT':
      return HttpStatus.GATEWAY_TIMEOUT;
    case 'AI_COACH_INVALID_RESPONSE':
      return HttpStatus.BAD_GATEWAY;
    default:
      return HttpStatus.SERVICE_UNAVAILABLE;
  }
}

function hashUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return `u${hash.toString(16)}`;
}
