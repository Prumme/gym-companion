import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CoachAction,
  CoachDecisionSummary,
  CoachLoadRecommendationSummary,
  CoachNotice,
  CoachPlateauSummary,
  CoachProgressSummary,
  CoachStrengthSummary,
  CoachingOverview,
  CoachingOverviewItem,
  ExerciseCoachSummary,
  ExerciseMeasurementType,
  LoadRecommendation,
  LoadRecommendationAction,
  PlateauAnalysis,
} from '@gym-companion/shared';
import {
  COACH_OVERVIEW_CANDIDATE_LIMIT,
  COACH_OVERVIEW_LIMIT,
  COACH_OVERVIEW_RECENCY_DAYS,
  addLocalDateDays,
  buildExerciseCoachActions,
  buildExerciseCoachNotices,
  compareExerciseCoachStatusPriority,
  computeCoachSummaryFingerprint,
  detectExercisePlateau,
  exerciseCoachSummaryQuerySchema,
  inferSignificantRecentProgress,
  localDateStringToUtcDate,
  resolveExerciseCoachHeadline,
  resolveExerciseCoachStatus,
  utcDateToLocalDateString,
  type PlateauSessionInput,
} from '@gym-companion/validation';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { CoachingService } from './coaching.service';

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class CoachSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coachingService: CoachingService,
    private readonly progressService: ProgressService,
  ) {}

  async getExerciseCoachSummary(
    userId: string,
    exerciseId: string,
    query: Record<string, string | undefined>,
  ): Promise<ExerciseCoachSummary> {
    const exercise = await this.findAccessibleExerciseOrThrow(userId, exerciseId);
    const parsed = exerciseCoachSummaryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Paramètres de requête invalides.',
      });
    }

    const equipmentId = parsed.data.equipmentId;
    const from = parsed.data.from;
    const to = parsed.data.to;
    const isWeightReps = exercise.measurementType === 'WEIGHT_REPS';

    const [progressMaxWeight, progressMaxReps, strength, plateau, context] =
      await Promise.all([
        this.progressService.getExerciseProgress(userId, exerciseId, {
          metric: isWeightReps ? 'MAX_WEIGHT' : undefined,
          from,
          to,
          equipmentId,
        }),
        isWeightReps
          ? this.progressService.getExerciseProgress(userId, exerciseId, {
              metric: 'MAX_REPS',
              from,
              to,
              equipmentId,
            })
          : Promise.resolve(null),
        isWeightReps
          ? this.progressService.getExerciseStrengthProgress(userId, exerciseId, {
              from,
              to,
              equipmentId,
            })
          : Promise.resolve(null),
        isWeightReps
          ? this.coachingService.getPlateauAnalysis(userId, exerciseId, {
              equipmentId,
            })
          : Promise.resolve(null),
        this.resolveLoadContext(userId, exerciseId, equipmentId),
      ]);

    let loadRecommendation: LoadRecommendation | null = null;
    if (isWeightReps && context.workoutTemplateExerciseId) {
      loadRecommendation = await this.coachingService.getLoadRecommendation(
        userId,
        context.workoutTemplateExerciseId,
      );
    }

    const recentDecision = await this.findLatestDecision(userId, exerciseId);

    const workoutCount = progressMaxWeight.points.length;
    const hasCompletedHistory = workoutCount > 0;
    const latestWorkoutDate =
      progressMaxWeight.summary?.latestDate ??
      plateau?.range.latestWorkoutDate ??
      null;

    const progressSummary = this.toProgressSummary(
      progressMaxWeight,
      progressMaxReps,
    );
    const strengthSummary = this.toStrengthSummary(strength);
    const plateauSummary = this.toPlateauSummary(plateau);
    const loadSummary = this.toLoadSummary(
      loadRecommendation,
      context.workoutTemplateExerciseId,
      context.programId,
    );

    const hasSignificantRecentProgress = inferSignificantRecentProgress({
      plateauStatus: plateau?.status ?? null,
      plateauReasons: plateau?.reasons ?? [],
      maxWeightChangeKg: progressSummary?.maxWeightKg.change ?? null,
      maxRepsChange: progressSummary?.maxReps.change ?? null,
      e1rmChangePercent:
        plateau?.trend.e1rmChangePercent ??
        strengthSummary?.changePercent ??
        null,
    });

    const status = resolveExerciseCoachStatus({
      hasCompletedHistory,
      measurementType: exercise.measurementType,
      plateauStatus: plateau?.status ?? null,
      loadRecommendationAction: loadRecommendation?.action ?? null,
      hasSignificantRecentProgress,
      hasSufficientHistory: workoutCount >= 3,
    });

    const headline = resolveExerciseCoachHeadline(status);
    const notices = buildExerciseCoachNotices({
      plateauStatus: plateau?.status ?? null,
      plateauReasons: plateau?.reasons ?? [],
      loadRecommendationAction: loadRecommendation?.action ?? null,
      loadRecommendationReasons: loadRecommendation?.reasons ?? [],
      effortDataMissing:
        (plateau?.effortCoverage.eligibleSetCount ?? 0) > 0 &&
        (plateau?.effortCoverage.trackedSetCount ?? 0) === 0,
    }) as CoachNotice[];

    const actions = buildExerciseCoachActions({
      exerciseId: exercise.id,
      programId: context.programId,
      hasActionableLoadRecommendation: Boolean(loadSummary?.actionable),
      hasProgress: hasCompletedHistory,
    }) as CoachAction[];

    const supported =
      hasCompletedHistory ||
      progressMaxWeight.availableMetrics.length > 0 ||
      isWeightReps;

    const generatedFrom = {
      latestWorkoutDate,
      workoutCount,
    };

    const coachSummaryFingerprint = computeCoachSummaryFingerprint({
      schemaVersion: 'AI_COACH_EXPLANATION_V1',
      exerciseId: exercise.id,
      measurementType: exercise.measurementType,
      status,
      loadRecommendation: loadSummary
        ? {
            action: loadSummary.action,
            currentWeightKg: loadSummary.currentWeightKg,
            suggestedWeightKg: loadSummary.suggestedWeightKg,
            reasons: loadSummary.reasons,
          }
        : null,
      plateau: plateauSummary
        ? {
            status: plateauSummary.status,
            reasons: plateauSummary.reasons,
            analyzedWorkoutCount: plateauSummary.analyzedWorkoutCount,
          }
        : null,
      progress: progressSummary
        ? {
            maxWeightFirstKg: progressSummary.maxWeightKg.first,
            maxWeightLatestKg: progressSummary.maxWeightKg.latest,
            maxRepsFirst: progressSummary.maxReps.first,
            maxRepsLatest: progressSummary.maxReps.latest,
            workoutCount: progressSummary.workoutCount,
          }
        : null,
      strength: strengthSummary
        ? {
            latestEstimatedOneRepMaxKg:
              strengthSummary.latestEstimatedOneRepMaxKg,
            bestEstimatedOneRepMaxKg: strengthSummary.bestEstimatedOneRepMaxKg,
            changeKg: strengthSummary.changeKg,
            changePercent: strengthSummary.changePercent,
          }
        : null,
      recentDecision: recentDecision
        ? {
            decisionType: recentDecision.decisionType,
            recommendationAction: recentDecision.recommendationAction,
            recommendedWeightKg: recentDecision.recommendedWeightKg,
            appliedWeightKg: recentDecision.appliedWeightKg,
            createdAt: recentDecision.createdAt,
          }
        : null,
      notices: notices.map((notice) => ({
        code: notice.code,
        severity: notice.severity,
      })),
      generatedFrom,
    });

    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        archived: exercise.archivedAt != null,
        measurementType: exercise.measurementType as ExerciseMeasurementType,
      },
      supported,
      status,
      headline,
      loadRecommendation: loadSummary,
      plateau: plateauSummary,
      progress: progressSummary,
      strength: strengthSummary,
      recentDecision,
      actions,
      notices,
      generatedFrom,
      coachSummaryFingerprint,
    };
  }

  async getCoachingOverview(userId: string): Promise<CoachingOverview> {
    const to = todayLocalDate();
    const from = addLocalDateDays(to, -(COACH_OVERVIEW_RECENCY_DAYS - 1));
    const fromDate = localDateStringToUtcDate(from);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        ownerUserId: userId,
        status: 'COMPLETED',
        localDate: { gte: fromDate },
        exercises: {
          some: { sourceExerciseId: { not: null } },
        },
      },
      orderBy: [{ localDate: 'desc' }, { startedAt: 'desc' }],
      select: {
        id: true,
        localDate: true,
        startedAt: true,
        exercises: {
          where: { sourceExerciseId: { not: null } },
          select: {
            sourceExerciseId: true,
            measurementTypeSnapshot: true,
            equipmentTypeId: true,
            exerciseNameSnapshot: true,
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

    type Candidate = {
      exerciseId: string;
      exerciseName: string;
      measurementType: string;
      latestWorkoutDate: string;
      sessions: PlateauSessionInput[];
    };

    const byExercise = new Map<string, Candidate>();

    for (const session of sessions) {
      const localDate = utcDateToLocalDateString(session.localDate);
      for (const occurrence of session.exercises) {
        const exerciseId = occurrence.sourceExerciseId;
        if (!exerciseId) continue;
        let candidate = byExercise.get(exerciseId);
        if (!candidate) {
          candidate = {
            exerciseId,
            exerciseName: occurrence.exerciseNameSnapshot,
            measurementType: occurrence.measurementTypeSnapshot,
            latestWorkoutDate: localDate,
            sessions: [],
          };
          byExercise.set(exerciseId, candidate);
        }
        const already = candidate.sessions.some(
          (item) => item.workoutSessionId === session.id,
        );
        if (already) {
          const existing = candidate.sessions.find(
            (item) => item.workoutSessionId === session.id,
          )!;
          existing.sets.push(
            ...occurrence.sets.map((set) => ({
              setType: set.setType,
              status: set.status,
              actualWeightKg:
                set.actualWeightKg == null ? null : Number(set.actualWeightKg),
              actualReps: set.actualReps,
              actualRir: set.actualRir,
              actualRpe: set.actualRpe == null ? null : Number(set.actualRpe),
              reachedFailure: set.reachedFailure,
              targetWeightKg:
                set.targetWeightKg == null ? null : Number(set.targetWeightKg),
              targetRepMin: set.targetRepMin,
              targetRepMax: set.targetRepMax,
            })),
          );
        } else {
          candidate.sessions.push({
            workoutSessionId: session.id,
            localDate,
            startedAt: session.startedAt.toISOString(),
            equipmentTypeId: occurrence.equipmentTypeId,
            sets: occurrence.sets.map((set) => ({
              setType: set.setType,
              status: set.status,
              actualWeightKg:
                set.actualWeightKg == null ? null : Number(set.actualWeightKg),
              actualReps: set.actualReps,
              actualRir: set.actualRir,
              actualRpe: set.actualRpe == null ? null : Number(set.actualRpe),
              reachedFailure: set.reachedFailure,
              targetWeightKg:
                set.targetWeightKg == null ? null : Number(set.targetWeightKg),
              targetRepMin: set.targetRepMin,
              targetRepMax: set.targetRepMax,
            })),
          });
        }
      }
    }

    const candidates = [...byExercise.values()]
      .sort((a, b) =>
        a.latestWorkoutDate < b.latestWorkoutDate
          ? 1
          : a.latestWorkoutDate > b.latestWorkoutDate
            ? -1
            : 0,
      )
      .slice(0, COACH_OVERVIEW_CANDIDATE_LIMIT);

    const items: CoachingOverviewItem[] = [];

    for (const candidate of candidates) {
      let status = resolveExerciseCoachStatus({
        hasCompletedHistory: candidate.sessions.length > 0,
        measurementType: candidate.measurementType,
        plateauStatus: null,
        loadRecommendationAction: null,
        hasSignificantRecentProgress: false,
        hasSufficientHistory: candidate.sessions.length >= 3,
      });

      if (candidate.measurementType === 'WEIGHT_REPS') {
        const plateau = detectExercisePlateau({
          exerciseId: candidate.exerciseId,
          measurementType: candidate.measurementType,
          sessions: candidate.sessions,
        });
        const progress = inferSignificantRecentProgress({
          plateauStatus: plateau.status,
          plateauReasons: plateau.reasons,
          maxWeightChangeKg: plateau.trend.loadChangeKg,
          maxRepsChange: plateau.trend.maxRepsChange,
          e1rmChangePercent: plateau.trend.e1rmChangePercent,
        });
        status = resolveExerciseCoachStatus({
          hasCompletedHistory: true,
          measurementType: candidate.measurementType,
          plateauStatus: plateau.status,
          loadRecommendationAction: null,
          hasSignificantRecentProgress: progress,
          hasSufficientHistory: candidate.sessions.length >= 3,
        });
      }

      if (
        status === 'REVIEW' ||
        status === 'PLATEAU' ||
        status === 'WATCH' ||
        status === 'PROGRESSING'
      ) {
        items.push({
          exerciseId: candidate.exerciseId,
          exerciseName: candidate.exerciseName,
          status,
          headline: resolveExerciseCoachHeadline(status).title,
          latestWorkoutDate: candidate.latestWorkoutDate,
        });
      }
    }

    items.sort((a, b) => {
      const byStatus = compareExerciseCoachStatusPriority(a.status, b.status);
      if (byStatus !== 0) return byStatus;
      if ((a.latestWorkoutDate ?? '') !== (b.latestWorkoutDate ?? '')) {
        return (a.latestWorkoutDate ?? '') < (b.latestWorkoutDate ?? '')
          ? 1
          : -1;
      }
      return a.exerciseName.localeCompare(b.exerciseName, 'fr');
    });

    return { items: items.slice(0, COACH_OVERVIEW_LIMIT) };
  }

  private async resolveLoadContext(
    userId: string,
    exerciseId: string,
    equipmentId?: string,
  ): Promise<{
    workoutTemplateExerciseId: string | null;
    programId: string | null;
  }> {
    const recent = await this.prisma.workoutSessionExercise.findFirst({
      where: {
        sourceExerciseId: exerciseId,
        workoutSession: {
          ownerUserId: userId,
          status: 'COMPLETED',
        },
        ...(equipmentId ? { equipmentTypeId: equipmentId } : {}),
      },
      orderBy: [
        { workoutSession: { localDate: 'desc' } },
        { workoutSession: { startedAt: 'desc' } },
      ],
      select: {
        sourceTemplateExerciseId: true,
      },
    });

    if (recent?.sourceTemplateExerciseId) {
      const wte = await this.prisma.workoutTemplateExercise.findFirst({
        where: {
          id: recent.sourceTemplateExerciseId,
          workoutTemplate: {
            program: { ownerUserId: userId },
          },
        },
        select: {
          id: true,
          workoutTemplate: { select: { programId: true } },
        },
      });
      if (wte) {
        return {
          workoutTemplateExerciseId: wte.id,
          programId: wte.workoutTemplate.programId,
        };
      }
    }

    const fallback = await this.prisma.workoutTemplateExercise.findFirst({
      where: {
        exerciseId,
        workoutTemplate: {
          program: {
            ownerUserId: userId,
            archivedAt: null,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        workoutTemplate: { select: { programId: true } },
      },
    });

    return {
      workoutTemplateExerciseId: fallback?.id ?? null,
      programId: fallback?.workoutTemplate.programId ?? null,
    };
  }

  private async findLatestDecision(
    userId: string,
    exerciseId: string,
  ): Promise<CoachDecisionSummary | null> {
    const row = await this.prisma.loadRecommendationDecision.findFirst({
      where: { ownerUserId: userId, exerciseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!row) return null;
    return {
      decisionType: row.decisionType,
      recommendationAction:
        row.recommendationAction as LoadRecommendationAction,
      recommendedWeightKg:
        row.recommendedWeightKg == null
          ? null
          : Number(row.recommendedWeightKg),
      appliedWeightKg:
        row.appliedWeightKg == null ? null : Number(row.appliedWeightKg),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toProgressSummary(
    maxWeight: Awaited<ReturnType<ProgressService['getExerciseProgress']>>,
    maxReps: Awaited<ReturnType<ProgressService['getExerciseProgress']>> | null,
  ): CoachProgressSummary | null {
    if (maxWeight.points.length === 0 && (maxReps?.points.length ?? 0) === 0) {
      return null;
    }
    return {
      maxWeightKg: {
        first: maxWeight.summary?.firstValue ?? null,
        latest: maxWeight.summary?.latestValue ?? null,
        change: maxWeight.summary?.absoluteChange ?? null,
      },
      maxReps: {
        first: maxReps?.summary?.firstValue ?? null,
        latest: maxReps?.summary?.latestValue ?? null,
        change: maxReps?.summary?.absoluteChange ?? null,
      },
      workoutCount: Math.max(
        maxWeight.points.length,
        maxReps?.points.length ?? 0,
      ),
    };
  }

  private toStrengthSummary(
    strength: Awaited<
      ReturnType<ProgressService['getExerciseStrengthProgress']>
    > | null,
  ): CoachStrengthSummary | null {
    if (!strength?.supported || !strength.summary) {
      return null;
    }
    return {
      latestEstimatedOneRepMaxKg:
        strength.summary.latestEstimatedOneRepMaxKg,
      bestEstimatedOneRepMaxKg: strength.summary.bestEstimatedOneRepMaxKg,
      changeKg: strength.summary.absoluteChangeKg,
      changePercent: strength.summary.percentageChange,
    };
  }

  private toPlateauSummary(
    plateau: PlateauAnalysis | null,
  ): CoachPlateauSummary | null {
    if (!plateau || !plateau.supported) {
      return null;
    }
    return {
      status: plateau.status,
      reasons: plateau.reasons,
      analyzedWorkoutCount: plateau.range.analyzedWorkoutCount,
      firstWorkoutDate: plateau.range.firstWorkoutDate,
      latestWorkoutDate: plateau.range.latestWorkoutDate,
    };
  }

  private toLoadSummary(
    recommendation: LoadRecommendation | null,
    workoutTemplateExerciseId: string | null,
    programId: string | null,
  ): CoachLoadRecommendationSummary | null {
    if (!recommendation || !recommendation.supported) {
      return null;
    }
    const actionable =
      recommendation.action === 'INCREASE' ||
      recommendation.action === 'HOLD' ||
      recommendation.action === 'DECREASE';
    return {
      action: recommendation.action,
      currentWeightKg: recommendation.currentTarget.weightKg,
      suggestedWeightKg: recommendation.recommendation.suggestedWeightKg,
      reasons: recommendation.reasons,
      workoutCount: recommendation.evidence.workoutCount,
      actionable,
      workoutTemplateExerciseId,
      programId,
    };
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
}
