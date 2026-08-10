import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  LoadRecommendation,
  LoadRecommendationReason,
} from '@gym-companion/shared';
import {
  LOAD_RECOMMENDATION_HISTORY_LIMIT,
  resolveLoadRecommendation,
  utcDateToLocalDateString,
  type EffortTrackingModeForLoad,
  type HistoricalWorkoutInput,
  type PerformedSetInput,
  type TemplateSetTargetInput,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';

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

@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLoadRecommendation(
    userId: string,
    workoutTemplateExerciseId: string,
  ): Promise<LoadRecommendation> {
    const templateExercise = await this.findOwnedTemplateExerciseOrThrow(
      userId,
      workoutTemplateExerciseId,
    );

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
      };
    }

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { effortTrackingMode: true },
    });
    const effortTrackingMode = (profile?.effortTrackingMode ??
      'NONE') as EffortTrackingModeForLoad;

    const recentWorkouts = await this.loadRecentEligibleWorkouts(
      userId,
      templateExercise.exerciseId,
    );

    const resolved = resolveLoadRecommendation({
      measurementType,
      templateEquipmentTypeId: templateExercise.equipmentTypeId,
      templateSets,
      recentWorkouts,
      effortTrackingMode,
      // Pas de préférence d’incrément en Prisma pour 5.1.
      userExerciseIncrementKg: null,
    });

    this.logger.debug(
      `load-recommendation templateExercise=${workoutTemplateExerciseId} action=${resolved.action}`,
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
    };
  }

  /**
   * Charge au plus 3 séances COMPLETED contenant l’exercice
   * (sourceExerciseId + WEIGHT_REPS). Pas de slice après chargement massif.
   */
  private async loadRecentEligibleWorkouts(
    userId: string,
    exerciseId: string,
  ): Promise<HistoricalWorkoutInput[]> {
    const sessions = await this.prisma.workoutSession.findMany({
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
      // Un snapshot sourceExerciseId null est déjà exclu par le filtre.
      const occurrence = session.exercises[0];
      if (!occurrence) {
        continue;
      }

      // Si plusieurs occurrences du même exercice dans une séance, on fusionne
      // les séries WORKING dans l’ordre (cas rare).
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

      // Équipement : si plusieurs occurrences avec équipements différents →
      // on expose le premier et le moteur pourra REVIEW via incohérence.
      const equipmentTypeId = occurrence.equipmentTypeId;
      const mixedEquipment = session.exercises.some(
        (ex) => ex.equipmentTypeId !== equipmentTypeId,
      );

      result.push({
        workoutSessionId: session.id,
        localDate: utcDateToLocalDateString(session.localDate),
        startedAt: session.startedAt.toISOString(),
        // Marqueur artificiel pour forcer REVIEW si mixte dans la même séance.
        equipmentTypeId: mixedEquipment
          ? `__mixed__:${equipmentTypeId ?? 'null'}`
          : equipmentTypeId,
        sets,
      });
    }

    return result;
  }

  private async findOwnedTemplateExerciseOrThrow(
    userId: string,
    workoutTemplateExerciseId: string,
  ) {
    const row = await this.prisma.workoutTemplateExercise.findFirst({
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
