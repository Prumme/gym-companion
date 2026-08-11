import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AiCoachChatReference,
  AiCoachConversationDetail,
  AiCoachConversationListItem,
  AiCoachConversationMessage,
  AiCoachProposalSummary,
  ApiCursorListResponse,
  ExerciseMeasurementType,
  SendAiCoachMessageResponse,
} from '@gym-companion/shared';
import {
  AI_COACH_CHAT_PROMPT_VERSION,
  AI_COACH_CHAT_SCHEMA_VERSION,
  AI_COACH_HISTORY_MESSAGE_LIMIT,
  AI_COACH_MAX_TOOL_CALLS_PER_TURN,
  AI_COACH_TOOL_DEFINITIONS,
  aiCoachConversationMessagesQuerySchema,
  aiCoachConversationsListQuerySchema,
  buildAiCoachConversationTitle,
  createAiCoachConversationBodySchema,
  decodeAiCoachConversationCursor,
  decodeAiCoachMessageCursor,
  encodeAiCoachConversationCursor,
  encodeAiCoachMessageCursor,
  filterAiCoachFollowUps,
  fingerprintAiCoachMessageContent,
  sendAiCoachMessageBodySchema,
  type AiCoachChatAnswer,
} from '@gym-companion/validation';
import type { AiCoachProposal, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  AiCoachProposalBusinessError,
  buildProposalPreview,
  toAiCoachProposalSummary,
  validateProposalContext,
} from './ai-coach-proposal-payload';
import { AiCoachRateLimiter } from './ai-coach-rate-limiter';
import {
  AI_COACH_PROVIDER,
  AiCoachProviderError,
  type AiCoachConversationProviderRequest,
  type AiCoachProvider,
} from './ai-coach-provider';
import { AiCoachToolRegistry } from './ai-coach-tool-registry';

/** Réponse de repli (discussion) quand une proposal échoue la revalidation métier serveur. */
const PROPOSAL_BUSINESS_INVALID_FALLBACK_TEXT =
  'Je n’ai pas pu valider automatiquement cette proposition (exercice obsolète ou cible invalide). Réessaie avec une description plus précise.';

@Injectable()
export class AiCoachChatService {
  private readonly logger = new Logger(AiCoachChatService.name);
  private readonly rateLimiter: AiCoachRateLimiter;
  private readonly busyConversations = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly toolRegistry: AiCoachToolRegistry,
    @Inject(AI_COACH_PROVIDER) private readonly provider: AiCoachProvider,
  ) {
    this.rateLimiter = new AiCoachRateLimiter(
      this.config.aiCoachRateLimitPerMinute,
    );
  }

  isAvailable(): boolean {
    return this.config.aiCoachAvailable;
  }

  getRateLimiterForTests(): AiCoachRateLimiter {
    return this.rateLimiter;
  }

  async createConversation(userId: string, body: unknown) {
    this.assertAiAvailable();
    const parsed = createAiCoachConversationBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Corps de requête invalide.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let contextExercise: {
      id: string;
      name: string;
      measurementType: ExerciseMeasurementType;
    } | null = null;

    if (parsed.data.exerciseId) {
      const exercise = await this.findAccessibleExerciseOrThrow(
        userId,
        parsed.data.exerciseId,
      );
      contextExercise = {
        id: exercise.id,
        name: exercise.name,
        measurementType: exercise.measurementType as ExerciseMeasurementType,
      };
    }

    const created = await this.prisma.aiCoachConversation.create({
      data: {
        ownerUserId: userId,
        contextExerciseId: contextExercise?.id ?? null,
        title: contextExercise
          ? buildAiCoachConversationTitle({
              exerciseName: contextExercise.name,
              firstMessage: '',
            })
          : null,
      },
    });

    return {
      id: created.id,
      title: created.title,
      contextExercise,
      archivedAt: null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      messages: [] as AiCoachConversationMessage[],
      pagination: { nextCursor: null, hasMore: false },
    } satisfies AiCoachConversationDetail;
  }

  async listConversations(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ApiCursorListResponse<AiCoachConversationListItem>> {
    this.assertAiAvailable();
    const parsed = aiCoachConversationsListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Paramètres invalides.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cursor = parsed.data.cursor
      ? decodeAiCoachConversationCursor(parsed.data.cursor)
      : null;
    if (parsed.data.cursor && !cursor) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Cursor invalide.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.prisma.aiCoachConversation.findMany({
      where: {
        ownerUserId: userId,
        archivedAt: null,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: new Date(cursor.updatedAt) } },
                {
                  updatedAt: new Date(cursor.updatedAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: parsed.data.limit + 1,
      include: {
        contextExercise: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
    });

    const hasMore = rows.length > parsed.data.limit;
    const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;
    const data: AiCoachConversationListItem[] = page.map((row) => ({
      id: row.id,
      title: row.title,
      contextExercise: row.contextExercise
        ? { id: row.contextExercise.id, name: row.contextExercise.name }
        : null,
      lastMessagePreview: row.messages[0]
        ? truncate(row.messages[0].content, 120)
        : null,
      updatedAt: row.updatedAt.toISOString(),
    }));

    const last = page[page.length - 1];
    return {
      data,
      pagination: {
        nextCursor:
          hasMore && last
            ? encodeAiCoachConversationCursor({
                updatedAt: last.updatedAt.toISOString(),
                id: last.id,
              })
            : null,
        hasMore,
      },
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<AiCoachConversationDetail> {
    this.assertAiAvailable();
    const conversation = await this.findOwnedConversationOrThrow(
      userId,
      conversationId,
    );
    const parsed = aiCoachConversationMessagesQuerySchema.safeParse(
      rawQuery ?? {},
    );
    if (!parsed.success) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Paramètres invalides.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cursor = parsed.data.cursor
      ? decodeAiCoachMessageCursor(parsed.data.cursor)
      : null;
    if (parsed.data.cursor && !cursor) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Cursor invalide.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.prisma.aiCoachMessage.findMany({
      where: {
        conversationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { gt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: parsed.data.limit + 1,
      include: { proposal: true },
    });

    const hasMore = rows.length > parsed.data.limit;
    const page = hasMore ? rows.slice(0, parsed.data.limit) : rows;
    const last = page[page.length - 1];

    return {
      id: conversation.id,
      title: conversation.title,
      contextExercise: conversation.contextExercise
        ? {
            id: conversation.contextExercise.id,
            name: conversation.contextExercise.name,
            measurementType: conversation.contextExercise
              .measurementType as ExerciseMeasurementType,
          }
        : null,
      archivedAt: conversation.archivedAt?.toISOString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: page.map((message) => this.mapMessage(message, message.proposal)),
      pagination: {
        nextCursor:
          hasMore && last
            ? encodeAiCoachMessageCursor({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              })
            : null,
        hasMore,
      },
    };
  }

  async archiveConversation(userId: string, conversationId: string) {
    this.assertAiAvailable();
    const conversation = await this.findOwnedConversationOrThrow(
      userId,
      conversationId,
    );
    if (conversation.archivedAt) {
      return { id: conversation.id, archivedAt: conversation.archivedAt.toISOString() };
    }
    const updated = await this.prisma.aiCoachConversation.update({
      where: { id: conversationId },
      data: { archivedAt: new Date() },
    });
    return { id: updated.id, archivedAt: updated.archivedAt!.toISOString() };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: unknown,
  ): Promise<SendAiCoachMessageResponse> {
    this.assertAiAvailable();
    const parsed = sendAiCoachMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { code: 'VALIDATION_ERROR', message: 'Message invalide.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!this.rateLimiter.tryConsume(userId)) {
      throw new HttpException(
        {
          code: 'AI_COACH_RATE_LIMITED',
          message: 'Trop de demandes au Coach. Réessaie plus tard.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const conversation = await this.findOwnedConversationOrThrow(
      userId,
      conversationId,
    );
    if (conversation.archivedAt) {
      throw new HttpException(
        {
          code: 'AI_COACH_CONVERSATION_ARCHIVED',
          message: 'Cette conversation est archivée.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const content = parsed.data.content;
    const fingerprint = fingerprintAiCoachMessageContent(content);

    const existing = await this.prisma.aiCoachMessage.findFirst({
      where: {
        conversationId,
        clientCommandId: parsed.data.clientCommandId,
      },
    });
    if (existing) {
      if (existing.payloadFingerprint !== fingerprint) {
        throw new ConflictException({
          code: 'AI_COACH_MESSAGE_COMMAND_CONFLICT',
          message: 'Commande déjà utilisée avec un contenu différent.',
        });
      }
      const assistant = await this.prisma.aiCoachMessage.findFirst({
        where: {
          conversationId,
          role: 'ASSISTANT',
          createdAt: { gt: existing.createdAt },
        },
        orderBy: { createdAt: 'asc' },
        include: { proposal: true },
      });
      return {
        userMessage: this.mapMessage(existing),
        assistantMessage: assistant
          ? this.mapMessage(assistant, assistant.proposal)
          : null,
      };
    }

    if (this.busyConversations.has(conversationId)) {
      throw new HttpException(
        {
          code: 'AI_COACH_CONVERSATION_BUSY',
          message: 'Une réponse est déjà en cours pour cette conversation.',
        },
        HttpStatus.CONFLICT,
      );
    }

    this.busyConversations.add(conversationId);
    const startedAt = Date.now();

    try {
      const userMessage = await this.prisma.$transaction(async (tx) => {
        const race = await tx.aiCoachMessage.findFirst({
          where: {
            conversationId,
            clientCommandId: parsed.data.clientCommandId,
          },
        });
        if (race) {
          if (race.payloadFingerprint !== fingerprint) {
            throw new ConflictException({
              code: 'AI_COACH_MESSAGE_COMMAND_CONFLICT',
              message: 'Commande déjà utilisée avec un contenu différent.',
            });
          }
          return race;
        }

        const created = await tx.aiCoachMessage.create({
          data: {
            conversationId,
            role: 'USER',
            content,
            clientCommandId: parsed.data.clientCommandId,
            payloadFingerprint: fingerprint,
          },
        });

        const title =
          conversation.title ??
          buildAiCoachConversationTitle({
            exerciseName: conversation.contextExercise?.name ?? null,
            firstMessage: content,
          });

        await tx.aiCoachConversation.update({
          where: { id: conversationId },
          data: {
            title,
            updatedAt: new Date(),
            generationStartedAt: new Date(),
          },
        });

        return created;
      });

      // Appel LLM hors transaction
      const historyRows = await this.prisma.aiCoachMessage.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: AI_COACH_HISTORY_MESSAGE_LIMIT + 1,
      });
      const chronological = historyRows.reverse();
      // Exclure le message USER courant de l’historique (il est passé séparément).
      const history = chronological
        .filter((row) => row.id !== userMessage.id)
        .slice(-AI_COACH_HISTORY_MESSAGE_LIMIT)
        .map((row) => ({
          role: row.role as 'USER' | 'ASSISTANT',
          content: row.content,
        }));

      const turnInput = {
        schemaVersion: AI_COACH_CHAT_SCHEMA_VERSION,
        promptVersion: AI_COACH_CHAT_PROMPT_VERSION,
        locale: 'fr-FR' as const,
        history,
        userMessage: content,
        contextExercise: conversation.contextExercise
          ? {
              id: conversation.contextExercise.id,
              name: conversation.contextExercise.name,
              measurementType: conversation.contextExercise.measurementType,
            }
          : null,
      };

      const {
        answer,
        toolInvocations,
        providerRequestId,
      } = await this.runToolLoop(userId, turnInput);

      // Jalon 8 — une proposal est revalidée intégralement avant persistance ;
      // si invalide (exercice obsolète, cible incohérente…), on ne persiste
      // jamais l’AiCoachProposal et on répond par un message discussion.
      const finalAnswer = await this.finalizeAnswer(userId, answer);

      const assistant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.aiCoachMessage.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: finalAnswer.text,
            providerRequestId,
            generatedFromSchemaVersion: AI_COACH_CHAT_SCHEMA_VERSION,
            promptVersion: AI_COACH_CHAT_PROMPT_VERSION,
            referencesJson: finalAnswer.references,
            suggestedFollowUpsJson: finalAnswer.suggestedFollowUps,
          },
        });

        if (toolInvocations.length > 0) {
          await tx.aiCoachToolInvocation.createMany({
            data: toolInvocations.map((invocation) => ({
              assistantMessageId: created.id,
              toolName: invocation.toolName,
              inputSnapshot: invocation.inputSnapshot as object,
              outputSummary: invocation.outputSummary as object,
            })),
          });
        }

        let proposal: AiCoachProposal | null = null;
        if (finalAnswer.type === 'proposal' && finalAnswer.data) {
          proposal = await tx.aiCoachProposal.create({
            data: {
              ownerUserId: userId,
              conversationId,
              messageId: created.id,
              kind: finalAnswer.data.kind === 'workout' ? 'WORKOUT' : 'PROGRAM',
              status: 'PENDING',
              payloadJson: (finalAnswer.data.kind === 'workout'
                ? finalAnswer.data.workout
                : finalAnswer.data.program) as unknown as Prisma.InputJsonValue,
              previewJson: finalAnswer.preview as unknown as Prisma.InputJsonValue,
            },
          });
        }

        await tx.aiCoachConversation.update({
          where: { id: conversationId },
          data: {
            updatedAt: new Date(),
            generationStartedAt: null,
          },
        });

        return { message: created, proposal };
      });

      this.logger.log({
        event: 'ai_coach_chat_turn',
        success: true,
        conversationId,
        durationMs: Date.now() - startedAt,
        toolCount: toolInvocations.length,
        toolNames: toolInvocations.map((item) => item.toolName),
        proposalKind: assistant.proposal?.kind ?? null,
        userHash: hashUserId(userId),
        provider: this.provider.name,
      });

      return {
        userMessage: this.mapMessage(userMessage),
        assistantMessage: this.mapMessage(assistant.message, assistant.proposal),
      };
    } catch (error) {
      await this.prisma.aiCoachConversation
        .update({
          where: { id: conversationId },
          data: { generationStartedAt: null },
        })
        .catch(() => undefined);

      this.logger.warn({
        event: 'ai_coach_chat_turn',
        success: false,
        conversationId,
        durationMs: Date.now() - startedAt,
        errorCode:
          error instanceof AiCoachProviderError
            ? error.code
            : error instanceof HttpException
              ? ((error.getResponse() as { code?: string })?.code ??
                'HTTP_ERROR')
              : 'UNKNOWN',
        userHash: hashUserId(userId),
        provider: this.provider.name,
      });

      if (error instanceof HttpException) throw error;
      if (error instanceof AiCoachProviderError) {
        throw new HttpException(
          {
            code: error.code,
            message: mapAiErrorMessage(error.code),
          },
          mapAiHttpStatus(error.code),
        );
      }
      throw new HttpException(
        {
          code: 'AI_COACH_UNAVAILABLE',
          message: 'L’explication IA n’est pas disponible pour le moment.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      this.busyConversations.delete(conversationId);
    }
  }

  /**
   * Jalon 8 — dernière étape avant persistance : revalide intégralement une
   * proposal (exercices, équipement, cibles). Si invalide, la proposal n’est
   * jamais persistée et la réponse bascule vers un message discussion.
   */
  private async finalizeAnswer(
    userId: string,
    answer: AiCoachChatAnswer,
  ): Promise<
    | {
        type: 'discussion';
        text: string;
        data: null;
        references: AiCoachChatReference[];
        suggestedFollowUps: string[];
        preview?: undefined;
      }
    | {
        type: 'proposal';
        text: string;
        data: NonNullable<AiCoachChatAnswer['data']>;
        references: AiCoachChatReference[];
        suggestedFollowUps: string[];
        preview: ReturnType<typeof buildProposalPreview>;
      }
  > {
    if (answer.type !== 'proposal' || !answer.data) {
      return {
        type: 'discussion',
        text: answer.text,
        data: null,
        references: answer.references,
        suggestedFollowUps: answer.suggestedFollowUps,
      };
    }

    const kind = answer.data.kind === 'workout' ? 'WORKOUT' : 'PROGRAM';
    try {
      const context = await validateProposalContext(
        this.prisma,
        userId,
        kind,
        answer.data.workout,
        answer.data.program,
      );
      const preview = buildProposalPreview(
        kind,
        answer.data.workout,
        answer.data.program,
        context,
      );
      return {
        type: 'proposal',
        text: answer.text,
        data: answer.data,
        references: answer.references,
        suggestedFollowUps: answer.suggestedFollowUps,
        preview,
      };
    } catch (error) {
      if (error instanceof AiCoachProposalBusinessError) {
        this.logger.warn({
          event: 'ai_coach_proposal_business_invalid',
          userHash: hashUserId(userId),
          reason: error.message,
        });
        return {
          type: 'discussion',
          text: PROPOSAL_BUSINESS_INVALID_FALLBACK_TEXT,
          data: null,
          references: [],
          suggestedFollowUps: [],
        };
      }
      throw error;
    }
  }

  private async runToolLoop(
    userId: string,
    turnInput: AiCoachConversationProviderRequest['input'],
  ): Promise<{
    answer: AiCoachChatAnswer;
    toolInvocations: Array<{
      toolName: string;
      inputSnapshot: Record<string, unknown>;
      outputSummary: Record<string, unknown>;
    }>;
    providerRequestId: string | null;
  }> {
    const allowedReferences = new Map<string, AiCoachChatReference>();
    const toolInvocations: Array<{
      toolName: string;
      inputSnapshot: Record<string, unknown>;
      outputSummary: Record<string, unknown>;
    }> = [];
    let pendingToolLoop: AiCoachConversationProviderRequest['pendingToolLoop'] =
      [];
    let toolCallsUsed = 0;
    let providerRequestId: string | null = null;

    for (let round = 0; round <= AI_COACH_MAX_TOOL_CALLS_PER_TURN; round += 1) {
      const forceFinal =
        toolCallsUsed >= AI_COACH_MAX_TOOL_CALLS_PER_TURN ||
        round === AI_COACH_MAX_TOOL_CALLS_PER_TURN;

      const result = await this.provider.generateConversationTurn({
        input: turnInput,
        tools: AI_COACH_TOOL_DEFINITIONS,
        timeoutMs: this.config.aiCoachTimeoutMs,
        model: this.config.aiCoachModel,
        pendingToolLoop,
        forceFinalAnswer: forceFinal,
      });

      providerRequestId = result.providerRequestId ?? providerRequestId;

      if (result.kind === 'answer') {
        return {
          answer: {
            ...result.answer,
            references: filterReferences(
              result.answer.references,
              allowedReferences,
            ),
            suggestedFollowUps: filterAiCoachFollowUps(
              result.answer.suggestedFollowUps,
            )
              .slice(0, 3),
          },
          toolInvocations,
          providerRequestId,
        };
      }

      const remaining = AI_COACH_MAX_TOOL_CALLS_PER_TURN - toolCallsUsed;
      const calls = result.toolCalls.slice(0, remaining);
      if (calls.length === 0) {
        continue;
      }

      const assistantToolMessage = {
        role: 'assistant' as const,
        content: result.assistantContent,
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: call.argumentsJson },
        })),
      };
      const toolMessages: Array<{
        role: 'tool';
        tool_call_id: string;
        content: string;
      }> = [];

      for (const call of calls) {
        let args: unknown = {};
        try {
          args = JSON.parse(call.argumentsJson);
        } catch {
          args = {};
        }
        const execution = await this.toolRegistry.execute(call.name, args, {
          ownerUserId: userId,
        });
        toolCallsUsed += 1;
        toolInvocations.push({
          toolName: execution.toolName,
          inputSnapshot: sanitizeSnapshot(args),
          outputSummary: execution.outputSummary,
        });
        for (const reference of execution.references) {
          allowedReferences.set(referenceKey(reference), reference);
        }
        toolMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(execution.llmPayload),
        });
      }

      pendingToolLoop = [
        ...(pendingToolLoop ?? []),
        assistantToolMessage,
        ...toolMessages,
      ];
    }

    return {
      answer: {
        type: 'discussion',
        text: 'Je n’ai pas pu finaliser l’analyse avec les outils disponibles. Réessaie avec une question plus précise.',
        data: null,
        references: [...allowedReferences.values()],
        suggestedFollowUps: [],
      },
      toolInvocations,
      providerRequestId,
    };
  }

  private assertAiAvailable(): void {
    if (!this.config.aiCoachEnabled || !this.config.aiCoachAvailable) {
      throw new HttpException(
        {
          code: 'AI_COACH_DISABLED',
          message: 'Les explications IA ne sont pas activées.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async findOwnedConversationOrThrow(
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.aiCoachConversation.findFirst({
      where: { id: conversationId, ownerUserId: userId },
      include: {
        contextExercise: {
          select: {
            id: true,
            name: true,
            measurementType: true,
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'AI_COACH_CONVERSATION_NOT_FOUND',
        message: 'Conversation introuvable.',
      });
    }
    return conversation;
  }

  private async findAccessibleExerciseOrThrow(
    userId: string,
    exerciseId: string,
  ) {
    const exercise = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ ownerUserId: userId }, { source: 'SYSTEM' }],
      },
      select: {
        id: true,
        name: true,
        measurementType: true,
        ownerUserId: true,
        source: true,
      },
    });
    // Exercice personnel d'un autre user → 404 neutre
    if (!exercise || (exercise.ownerUserId && exercise.ownerUserId !== userId)) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }
    return exercise;
  }

  private mapMessage(
    message: {
      id: string;
      role: string;
      content: string;
      referencesJson?: unknown;
      suggestedFollowUpsJson?: unknown;
      createdAt: Date;
    },
    proposal?: AiCoachProposal | null,
  ): AiCoachConversationMessage {
    let proposalSummary: AiCoachProposalSummary | null = null;
    if (proposal) {
      proposalSummary = toAiCoachProposalSummary(proposal);
    }
    return {
      id: message.id,
      role: message.role as 'USER' | 'ASSISTANT',
      content: message.content,
      references: Array.isArray(message.referencesJson)
        ? (message.referencesJson as AiCoachChatReference[])
        : [],
      suggestedFollowUps: Array.isArray(message.suggestedFollowUpsJson)
        ? (message.suggestedFollowUpsJson as string[])
        : [],
      proposal: proposalSummary,
      createdAt: message.createdAt.toISOString(),
    };
  }
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function referenceKey(reference: AiCoachChatReference): string {
  if (reference.type === 'WORKOUT') {
    return `WORKOUT:${reference.workoutSessionId}`;
  }
  return `${reference.type}:${reference.exerciseId}`;
}

function filterReferences(
  proposed: AiCoachChatReference[],
  allowed: Map<string, AiCoachChatReference>,
): AiCoachChatReference[] {
  const result: AiCoachChatReference[] = [];
  for (const reference of proposed) {
    const key = referenceKey(reference);
    const trusted = allowed.get(key);
    if (!trusted) continue;
    if (!result.some((item) => referenceKey(item) === key)) {
      result.push(trusted);
    }
  }
  return result;
}

function sanitizeSnapshot(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  const entries = Object.entries(args as Record<string, unknown>).filter(
    ([key]) => key !== 'ownerUserId' && key !== 'userId',
  );
  return Object.fromEntries(entries);
}

function mapAiErrorMessage(code: string): string {
  switch (code) {
    case 'AI_COACH_TIMEOUT':
      return 'Le Coach a pris trop de temps à répondre.';
    case 'AI_COACH_RATE_LIMITED':
      return 'Trop de demandes au Coach. Réessaie plus tard.';
    case 'AI_COACH_INVALID_RESPONSE':
      return 'Le Coach n’a pas pu produire une réponse exploitable.';
    default:
      return 'Le Coach n’est pas disponible pour le moment.';
  }
}

function mapAiHttpStatus(code: string): HttpStatus {
  switch (code) {
    case 'AI_COACH_RATE_LIMITED':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'AI_COACH_TIMEOUT':
      return HttpStatus.GATEWAY_TIMEOUT;
    case 'AI_COACH_INVALID_RESPONSE':
      return HttpStatus.BAD_GATEWAY;
    default:
      return HttpStatus.SERVICE_UNAVAILABLE;
  }
}

function hashUserId(userId: string): string {
  return `u${createHash('sha256').update(userId).digest('hex').slice(0, 12)}`;
}

/** Export pour tests éventuels. */
export function createClientCommandId(): string {
  return randomUUID();
}
