import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  DecideLoadRecommendationResult,
  LoadIncrementSource,
  LoadRecommendation,
  LoadRecommendationDecisionDto,
  LoadRecommendationDecisionListItem,
  LoadRecommendationDecisionListResponse,
  LoadRecommendationReason,
  PlateauAnalysis,
  ProgramDetail,
  WorkoutTemplateExerciseDetail,
} from '@gym-companion/shared';
import {
  LOAD_RECOMMENDATION_ENGINE_VERSION,
  LOAD_RECOMMENDATION_HISTORY_LIMIT,
  PLATEAU_HISTORY_LIMIT,
  buildLoadRecommendationDecisionPayloadFingerprint,
  buildLoadRecommendationFingerprint,
  decideLoadRecommendationSchema,
  decodeLoadRecommendationDecisionCursor,
  detectExercisePlateau,
  encodeLoadRecommendationDecisionCursor,
  loadRecommendationDecisionsQuerySchema,
  plateauAnalysisQuerySchema,
  resolveAppliedWeightKg,
  resolveLoadRecommendation,
  utcDateToLocalDateString,
  type EffortTrackingModeForLoad,
  type HistoricalWorkoutInput,
  type PerformedSetInput,
  type PlateauSessionInput,
  type TemplateSetTargetInput,
} from '@gym-companion/validation';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import { ProgramsService } from '../programs/programs.service';

function decimalToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type TemplateExerciseRow = {
  id: string;
  workoutTemplateId: string;
  exerciseId: string;
  equipmentTypeId: string | null;
  sets: Array<{
    id: string;
    setType: string;
    targetRepMin: number | null;
    targetRepMax: number | null;
    targetWeightKg: unknown;
    targetRir: number | null;
    targetRpe: unknown;
  }>;
  exercise: {
    id: string;
    measurementType: string;
    archivedAt: Date | null;
  };
  workoutTemplate: {
    id: string;
    program: {
      id: string;
      ownerUserId: string;
      status: string;
      archivedAt: Date | null;
    };
  };
};

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly programsService: ProgramsService,
  ) {}

  async getLoadRecommendation(
    userId: string,
    workoutTemplateExerciseId: string,
  ): Promise<LoadRecommendation> {
    const templateExercise = await this.findOwnedTemplateExerciseOrThrow(
      userId,
      workoutTemplateExerciseId,
    );
    return this.computeRecommendation(userId, templateExercise);
  }

  async getPlateauAnalysis(
    userId: string,
    exerciseId: string,
    query: Record<string, string | undefined>,
  ): Promise<PlateauAnalysis> {
    const exercise = await this.findAccessibleExerciseOrThrow(userId, exerciseId);

    const parsed = plateauAnalysisQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Paramètres de requête invalides.',
      });
    }

    if (exercise.measurementType !== 'WEIGHT_REPS') {
      return {
        exerciseId: exercise.id,
        supported: false,
        status: 'INSUFFICIENT_DATA',
        range: {
          analyzedWorkoutCount: 0,
          firstWorkoutDate: null,
          latestWorkoutDate: null,
        },
        current: {
          maxWeightKg: null,
          maxReps: null,
          estimatedOneRepMaxKg: null,
        },
        trend: {
          loadChangeKg: null,
          e1rmChangeKg: null,
          e1rmChangePercent: null,
          maxRepsChange: null,
        },
        evidence: [],
        reasons: ['UNSUPPORTED_MEASUREMENT_TYPE'],
        effortCoverage: { trackedSetCount: 0, eligibleSetCount: 0 },
      };
    }

    const sessions = await this.loadPlateauSessions(
      userId,
      exercise.id,
      parsed.data.equipmentId,
    );

    return detectExercisePlateau({
      exerciseId: exercise.id,
      measurementType: exercise.measurementType,
      sessions,
      equipmentTypeId: parsed.data.equipmentId ?? null,
    });
  }

  private async loadPlateauSessions(
    userId: string,
    exerciseId: string,
    equipmentId?: string,
  ): Promise<PlateauSessionInput[]> {
    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        ownerUserId: userId,
        status: 'COMPLETED',
        exercises: {
          some: {
            sourceExerciseId: exerciseId,
            measurementTypeSnapshot: 'WEIGHT_REPS',
            ...(equipmentId ? { equipmentTypeId: equipmentId } : {}),
          },
        },
      },
      orderBy: [{ localDate: 'desc' }, { startedAt: 'desc' }],
      take: PLATEAU_HISTORY_LIMIT * 2,
      select: {
        id: true,
        localDate: true,
        startedAt: true,
        exercises: {
          where: {
            sourceExerciseId: exerciseId,
            measurementTypeSnapshot: 'WEIGHT_REPS',
            ...(equipmentId ? { equipmentTypeId: equipmentId } : {}),
          },
          select: {
            equipmentTypeId: true,
            sets: {
              orderBy: { position: 'asc' },
              select: {
                setType: true,
                status: true,
                actualWeightKg: true,
                actualReps: true,
                actualRir: true,
                actualRpe: true,
                reachedFailure: true,
                targetWeightKg: true,
                targetRepMin: true,
                targetRepMax: true,
              },
            },
          },
        },
      },
    });

    const result: PlateauSessionInput[] = [];
    for (const session of sessions) {
      if (session.exercises.length === 0) {
        continue;
      }
      const equipmentIds = new Set(
        session.exercises.map((ex) => ex.equipmentTypeId),
      );
      const equipmentTypeId =
        equipmentIds.size === 1
          ? (session.exercises[0]?.equipmentTypeId ?? null)
          : `__mixed__:${[...equipmentIds].join(',')}`;

      const sets = session.exercises.flatMap((ex) =>
        ex.sets.map((set) => ({
          setType: set.setType,
          status: set.status,
          actualWeightKg: decimalToNumber(set.actualWeightKg),
          actualReps: set.actualReps,
          actualRir: set.actualRir,
          actualRpe: decimalToNumber(set.actualRpe),
          reachedFailure: set.reachedFailure,
          targetWeightKg: decimalToNumber(set.targetWeightKg),
          targetRepMin: set.targetRepMin,
          targetRepMax: set.targetRepMax,
        })),
      );

      result.push({
        workoutSessionId: session.id,
        localDate: utcDateToLocalDateString(session.localDate),
        startedAt: session.startedAt.toISOString(),
        equipmentTypeId,
        sets,
      });
    }
    return result;
  }

  private async findAccessibleExerciseOrThrow(
    userId: string,
    exerciseId: string,
  ) {
    const row = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      },
      select: {
        id: true,
        name: true,
        measurementType: true,
        archivedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }
    return row;
  }

  async decideLoadRecommendation(
    userId: string,
    workoutTemplateExerciseId: string,
    rawInput: unknown,
  ): Promise<DecideLoadRecommendationResult> {
    const parsed = decideLoadRecommendationSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code =
        typeof issue?.message === 'string' &&
        issue.message.startsWith('LOAD_RECOMMENDATION_')
          ? issue.message
          : 'VALIDATION_ERROR';
      throw new BadRequestException({
        code,
        message:
          code === 'VALIDATION_ERROR'
            ? 'Payload de décision invalide.'
            : this.decisionErrorMessage(code),
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }
    const input = parsed.data;

    const payloadFingerprint =
      buildLoadRecommendationDecisionPayloadFingerprint({
        recommendationFingerprint: input.recommendationFingerprint,
        decision: input.decision,
        adjustedWeightKg: input.adjustedWeightKg ?? null,
        userNote: input.userNote ?? null,
      });

    const existing = await this.prisma.loadRecommendationDecision.findUnique({
      where: {
        ownerUserId_clientCommandId: {
          ownerUserId: userId,
          clientCommandId: input.clientCommandId,
        },
      },
    });
    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        throw new ConflictException({
          code: 'LOAD_RECOMMENDATION_COMMAND_CONFLICT',
          message:
            'Cette commande a déjà été utilisée avec un autre contenu.',
        });
      }
      return this.buildDecideResultFromExisting(
        userId,
        workoutTemplateExerciseId,
        existing.id,
      );
    }

    let createdId: string;
    let programId: string;

    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        const race = await tx.loadRecommendationDecision.findUnique({
          where: {
            ownerUserId_clientCommandId: {
              ownerUserId: userId,
              clientCommandId: input.clientCommandId,
            },
          },
        });
        if (race) {
          if (race.payloadFingerprint !== payloadFingerprint) {
            throw new ConflictException({
              code: 'LOAD_RECOMMENDATION_COMMAND_CONFLICT',
              message:
                'Cette commande a déjà été utilisée avec un autre contenu.',
            });
          }
          return { kind: 'idempotent' as const, decisionId: race.id };
        }

        const templateExercise = await this.findOwnedTemplateExerciseOrThrow(
          userId,
          workoutTemplateExerciseId,
          tx,
        );

        if (templateExercise.workoutTemplate.program.archivedAt) {
          throw new ForbiddenException({
            code: 'PROGRAM_NOT_EDITABLE',
            message: 'Un programme archivé ne peut pas être modifié.',
          });
        }

        const recommendation = await this.computeRecommendation(
          userId,
          templateExercise,
          tx,
        );

        if (
          recommendation.recommendationFingerprint !==
          input.recommendationFingerprint
        ) {
          throw new ConflictException({
            code: 'LOAD_RECOMMENDATION_STALE',
            message:
              'La recommandation a changé depuis son affichage. Rechargez-la avant de décider.',
          });
        }

        const applied = resolveAppliedWeightKg({
          action: recommendation.action,
          decision: input.decision,
          currentTargetWeightKg: recommendation.currentTarget.weightKg,
          suggestedWeightKg: recommendation.recommendation.suggestedWeightKg,
          adjustedWeightKg: input.adjustedWeightKg ?? null,
        });

        if (!applied.ok) {
          throw new BadRequestException({
            code: applied.code,
            message: applied.message,
          });
        }

        if (applied.mutatesTemplate && applied.appliedWeightKg != null) {
          const workingSets = templateExercise.sets.filter(
            (set) => set.setType === 'WORKING',
          );
          for (const set of workingSets) {
            await tx.workoutTemplateSet.update({
              where: { id: set.id },
              data: { targetWeightKg: applied.appliedWeightKg },
            });
          }
        }

        const created = await tx.loadRecommendationDecision.create({
          data: {
            ownerUserId: userId,
            workoutTemplateExerciseId: templateExercise.id,
            workoutTemplateId: templateExercise.workoutTemplateId,
            programId: templateExercise.workoutTemplate.program.id,
            exerciseId: templateExercise.exerciseId,
            engineVersion: recommendation.engineVersion,
            recommendationFingerprint:
              recommendation.recommendationFingerprint,
            recommendationAction: recommendation.action,
            decisionType: input.decision,
            currentTargetWeightKg: recommendation.currentTarget.weightKg,
            recommendedWeightKg:
              recommendation.recommendation.suggestedWeightKg,
            appliedWeightKg: applied.appliedWeightKg,
            incrementKg: recommendation.recommendation.incrementKg,
            incrementSource: recommendation.recommendation.incrementSource,
            reasons: recommendation.reasons,
            evidenceSnapshot: {
              workoutCount: recommendation.evidence.workoutCount,
              latestWorkoutDate: recommendation.evidence.latestWorkoutDate,
              effortDataUsed: recommendation.evidence.effortDataUsed,
              recentWorkouts: recommendation.evidence.recentWorkouts,
            },
            userNote: input.userNote ?? null,
            clientCommandId: input.clientCommandId,
            payloadFingerprint,
          },
        });

        return {
          kind: 'created' as const,
          decisionId: created.id,
          programId: templateExercise.workoutTemplate.program.id,
        };
      });

      if (txResult.kind === 'idempotent') {
        return this.buildDecideResultFromExisting(
          userId,
          workoutTemplateExerciseId,
          txResult.decisionId,
        );
      }

      createdId = txResult.decisionId;
      programId = txResult.programId;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const again = await this.prisma.loadRecommendationDecision.findUnique({
          where: {
            ownerUserId_clientCommandId: {
              ownerUserId: userId,
              clientCommandId: input.clientCommandId,
            },
          },
        });
        if (again && again.payloadFingerprint === payloadFingerprint) {
          return this.buildDecideResultFromExisting(
            userId,
            workoutTemplateExerciseId,
            again.id,
          );
        }
        throw new ConflictException({
          code: 'LOAD_RECOMMENDATION_COMMAND_CONFLICT',
          message:
            'Cette commande a déjà été utilisée avec un autre contenu.',
        });
      }
      throw error;
    }

    const decision = await this.prisma.loadRecommendationDecision.findFirstOrThrow(
      {
        where: { id: createdId, ownerUserId: userId },
      },
    );
    const program = await this.programsService.getById(userId, programId);
    const templateExercise = await this.findOwnedTemplateExerciseOrThrow(
      userId,
      workoutTemplateExerciseId,
    );
    const templateExerciseDetail = this.findTemplateExerciseInProgram(
      program,
      templateExercise.workoutTemplateId,
      templateExercise.id,
    );
    const recommendation = await this.computeRecommendation(
      userId,
      templateExercise,
    );

    return {
      decision: this.toDecisionDto(decision),
      templateExercise: templateExerciseDetail,
      program,
      recommendation,
    };
  }

  async listLoadRecommendationDecisions(
    userId: string,
    workoutTemplateExerciseId: string,
    query: Record<string, string | undefined>,
  ): Promise<LoadRecommendationDecisionListResponse> {
    await this.findOwnedTemplateExerciseOrThrow(
      userId,
      workoutTemplateExerciseId,
    );

    const parsed = loadRecommendationDecisionsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Paramètres de pagination invalides.',
      });
    }

    const limit = parsed.data.limit ?? 20;
    let cursorFilter: Prisma.LoadRecommendationDecisionWhereInput = {};
    if (parsed.data.cursor) {
      const cursor = decodeLoadRecommendationDecisionCursor(parsed.data.cursor);
      if (!cursor) {
        throw new BadRequestException({
          code: 'LOAD_RECOMMENDATION_INVALID_CURSOR',
          message: 'Curseur de pagination invalide.',
        });
      }
      const createdAt = new Date(cursor.createdAt);
      cursorFilter = {
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: cursor.id } },
        ],
      };
    }

    const rows = await this.prisma.loadRecommendationDecision.findMany({
      where: {
        ownerUserId: userId,
        workoutTemplateExerciseId,
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeLoadRecommendationDecisionCursor({
            version: 1,
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      data: page.map((row) => this.toDecisionListItem(row)),
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  private async buildDecideResultFromExisting(
    userId: string,
    workoutTemplateExerciseId: string,
    decisionId: string,
  ): Promise<DecideLoadRecommendationResult> {
    const decision =
      await this.prisma.loadRecommendationDecision.findFirstOrThrow({
        where: { id: decisionId, ownerUserId: userId },
      });
    const templateExercise = await this.findOwnedTemplateExerciseOrThrow(
      userId,
      workoutTemplateExerciseId,
    );
    const program = await this.programsService.getById(
      userId,
      templateExercise.workoutTemplate.program.id,
    );
    const templateExerciseDetail = this.findTemplateExerciseInProgram(
      program,
      templateExercise.workoutTemplateId,
      templateExercise.id,
    );
    const recommendation = await this.computeRecommendation(
      userId,
      templateExercise,
    );
    return {
      decision: this.toDecisionDto(decision),
      templateExercise: templateExerciseDetail,
      program,
      recommendation,
    };
  }

  private findTemplateExerciseInProgram(
    program: ProgramDetail,
    workoutTemplateId: string,
    templateExerciseId: string,
  ): WorkoutTemplateExerciseDetail {
    const template = program.workoutTemplates.find(
      (item) => item.id === workoutTemplateId,
    );
    const exercise = template?.exercises.find(
      (item) => item.id === templateExerciseId,
    );
    if (!exercise) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND',
        message: 'Exercice du modèle introuvable.',
      });
    }
    return exercise;
  }

  private async computeRecommendation(
    userId: string,
    templateExercise: TemplateExerciseRow,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<LoadRecommendation> {
    const measurementType = templateExercise.exercise.measurementType;
    const templateSets: TemplateSetTargetInput[] = templateExercise.sets.map(
      (set) => ({
        setType: set.setType,
        targetRepMin: set.targetRepMin,
        targetRepMax: set.targetRepMax,
        targetWeightKg: decimalToNumber(set.targetWeightKg),
        targetRir: set.targetRir,
        targetRpe: decimalToNumber(set.targetRpe),
      }),
    );

    if (measurementType !== 'WEIGHT_REPS') {
      const fingerprint = buildLoadRecommendationFingerprint({
        workoutTemplateExerciseId: templateExercise.id,
        engineVersion: LOAD_RECOMMENDATION_ENGINE_VERSION,
        templateEquipmentTypeId: templateExercise.equipmentTypeId,
        workingSets: [],
        action: 'INSUFFICIENT_DATA',
        currentTargetWeightKg: null,
        suggestedWeightKg: null,
        incrementKg: null,
        incrementSource: null,
        recentWorkoutSessionIds: [],
      });
      return {
        workoutTemplateExerciseId: templateExercise.id,
        exerciseId: templateExercise.exerciseId,
        supported: false,
        action: 'INSUFFICIENT_DATA',
        currentTarget: {
          weightKg: null,
          minReps: null,
          maxReps: null,
          targetRir: null,
          targetRpe: null,
        },
        recommendation: {
          suggestedWeightKg: null,
          adjustmentKg: null,
          incrementKg: null,
          incrementSource: null,
        },
        evidence: {
          workoutCount: 0,
          latestWorkoutDate: null,
          effortDataUsed: false,
          recentWorkouts: [],
        },
        reasons: ['UNSUPPORTED_MEASUREMENT_TYPE' as LoadRecommendationReason],
        engineVersion: LOAD_RECOMMENDATION_ENGINE_VERSION,
        recommendationFingerprint: fingerprint,
      };
    }

    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: { effortTrackingMode: true },
    });
    const effortTrackingMode = (profile?.effortTrackingMode ??
      'NONE') as EffortTrackingModeForLoad;

    const recentWorkouts = await this.loadRecentEligibleWorkouts(
      userId,
      templateExercise.exerciseId,
      db,
    );

    // Cas B (clôture 5.7) : `UserExercisePreference` n’expose pas encore
    // d’incrément utilisateur. Toujours SYSTEM_DEFAULT (2,5 kg) jusqu’à
    // l’ajout éventuel d’un champ dédié — ne pas inventer une seconde source.
    const resolved = resolveLoadRecommendation({
      workoutTemplateExerciseId: templateExercise.id,
      measurementType,
      templateEquipmentTypeId: templateExercise.equipmentTypeId,
      templateSets,
      recentWorkouts,
      effortTrackingMode,
      userExerciseIncrementKg: null,
    });

    this.logger.debug(
      `load-recommendation templateExercise=${templateExercise.id} action=${resolved.action}`,
    );

    return {
      workoutTemplateExerciseId: templateExercise.id,
      exerciseId: templateExercise.exerciseId,
      supported: true,
      action: resolved.action,
      currentTarget: resolved.currentTarget,
      recommendation: resolved.recommendation,
      evidence: resolved.evidence,
      reasons: resolved.reasons as LoadRecommendationReason[],
      engineVersion: resolved.engineVersion,
      recommendationFingerprint: resolved.recommendationFingerprint,
    };
  }

  private async loadRecentEligibleWorkouts(
    userId: string,
    exerciseId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<HistoricalWorkoutInput[]> {
    const sessions = await db.workoutSession.findMany({
      where: {
        ownerUserId: userId,
        status: 'COMPLETED',
        exercises: {
          some: {
            sourceExerciseId: exerciseId,
            measurementTypeSnapshot: 'WEIGHT_REPS',
          },
        },
      },
      orderBy: [{ localDate: 'desc' }, { startedAt: 'desc' }],
      take: LOAD_RECOMMENDATION_HISTORY_LIMIT,
      select: {
        id: true,
        localDate: true,
        startedAt: true,
        exercises: {
          where: {
            sourceExerciseId: exerciseId,
            measurementTypeSnapshot: 'WEIGHT_REPS',
          },
          select: {
            equipmentTypeId: true,
            sets: {
              orderBy: { position: 'asc' },
              select: {
                setType: true,
                status: true,
                actualReps: true,
                actualWeightKg: true,
                actualRir: true,
                actualRpe: true,
                targetWeightKg: true,
              },
            },
          },
        },
      },
    });

    const result: HistoricalWorkoutInput[] = [];

    for (const session of sessions) {
      const occurrence = session.exercises[0];
      if (!occurrence) {
        continue;
      }

      const sets: PerformedSetInput[] = session.exercises.flatMap((ex) =>
        ex.sets.map((set) => ({
          setType: set.setType,
          status: set.status,
          actualReps: set.actualReps,
          actualWeightKg: decimalToNumber(set.actualWeightKg),
          actualRir: set.actualRir,
          actualRpe: decimalToNumber(set.actualRpe),
          targetWeightKg: decimalToNumber(set.targetWeightKg),
        })),
      );

      const equipmentTypeId = occurrence.equipmentTypeId;
      const mixedEquipment = session.exercises.some(
        (ex) => ex.equipmentTypeId !== equipmentTypeId,
      );

      result.push({
        workoutSessionId: session.id,
        localDate: utcDateToLocalDateString(session.localDate),
        startedAt: session.startedAt.toISOString(),
        equipmentTypeId: mixedEquipment
          ? `__mixed__:${equipmentTypeId ?? 'null'}`
          : equipmentTypeId,
        sets,
      });
    }

    return result;
  }

  private toDecisionDto(row: {
    id: string;
    engineVersion: string;
    recommendationFingerprint: string;
    recommendationAction: string;
    decisionType: string;
    currentTargetWeightKg: unknown;
    recommendedWeightKg: unknown;
    appliedWeightKg: unknown;
    incrementKg: unknown;
    incrementSource: string | null;
    reasons: unknown;
    evidenceSnapshot: unknown;
    userNote: string | null;
    createdAt: Date;
  }): LoadRecommendationDecisionDto {
    const evidence = row.evidenceSnapshot as {
      latestWorkoutDate?: string | null;
    } | null;
    return {
      id: row.id,
      engineVersion: row.engineVersion,
      recommendationFingerprint: row.recommendationFingerprint,
      recommendationAction:
        row.recommendationAction as LoadRecommendationDecisionDto['recommendationAction'],
      decisionType:
        row.decisionType as LoadRecommendationDecisionDto['decisionType'],
      currentTargetWeightKg: decimalToNumber(row.currentTargetWeightKg),
      recommendedWeightKg: decimalToNumber(row.recommendedWeightKg),
      appliedWeightKg: decimalToNumber(row.appliedWeightKg),
      incrementKg: decimalToNumber(row.incrementKg),
      incrementSource: row.incrementSource as LoadIncrementSource | null,
      reasons: Array.isArray(row.reasons)
        ? (row.reasons as LoadRecommendationReason[])
        : [],
      latestEvidenceWorkoutDate: evidence?.latestWorkoutDate ?? null,
      userNote: row.userNote,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDecisionListItem(row: {
    id: string;
    engineVersion: string;
    recommendationAction: string;
    decisionType: string;
    currentTargetWeightKg: unknown;
    recommendedWeightKg: unknown;
    appliedWeightKg: unknown;
    reasons: unknown;
    evidenceSnapshot: unknown;
    userNote: string | null;
    createdAt: Date;
  }): LoadRecommendationDecisionListItem {
    const evidence = row.evidenceSnapshot as {
      latestWorkoutDate?: string | null;
    } | null;
    return {
      id: row.id,
      engineVersion: row.engineVersion,
      recommendationAction:
        row.recommendationAction as LoadRecommendationDecisionListItem['recommendationAction'],
      decisionType:
        row.decisionType as LoadRecommendationDecisionListItem['decisionType'],
      currentTargetWeightKg: decimalToNumber(row.currentTargetWeightKg),
      recommendedWeightKg: decimalToNumber(row.recommendedWeightKg),
      appliedWeightKg: decimalToNumber(row.appliedWeightKg),
      reasons: Array.isArray(row.reasons)
        ? (row.reasons as LoadRecommendationReason[])
        : [],
      latestEvidenceWorkoutDate: evidence?.latestWorkoutDate ?? null,
      userNote: row.userNote,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private decisionErrorMessage(code: string): string {
    switch (code) {
      case 'LOAD_RECOMMENDATION_ADJUSTED_WEIGHT_REQUIRED':
        return 'Une charge ajustée est requise.';
      case 'LOAD_RECOMMENDATION_INVALID_DECISION':
        return 'Cette combinaison décision / charge est invalide.';
      default:
        return 'Décision invalide.';
    }
  }

  private async findOwnedTemplateExerciseOrThrow(
    userId: string,
    workoutTemplateExerciseId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TemplateExerciseRow> {
    const row = await db.workoutTemplateExercise.findFirst({
      where: { id: workoutTemplateExerciseId },
      include: {
        sets: { orderBy: { position: 'asc' } },
        exercise: {
          select: {
            id: true,
            measurementType: true,
            archivedAt: true,
          },
        },
        workoutTemplate: {
          select: {
            id: true,
            program: {
              select: {
                id: true,
                ownerUserId: true,
                status: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!row || row.workoutTemplate.program.ownerUserId !== userId) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND',
        message: 'Exercice du modèle introuvable.',
      });
    }

    return row;
  }
}
