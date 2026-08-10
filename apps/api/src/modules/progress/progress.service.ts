import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ExerciseProgressMetric,
  ExerciseProgressPoint,
  ExerciseProgressResponse,
} from '@gym-companion/shared';
import {
  EXERCISE_PROGRESS_MAX_POINTS,
  compareExerciseProgressPointsAsc,
  computeExerciseProgressSummary,
  computeExerciseWorkoutProgressPoint,
  localDateStringToUtcDate,
  parseExerciseProgressQuery,
  resolveAvailableProgressMetrics,
  resolveAvailableProgressMetricsFromTypes,
  resolveDefaultProgressMetric,
  utcDateToLocalDateString,
  type ExerciseMeasurementTypeForProgress,
  type ExerciseProgressOccurrenceInput,
  type ExerciseProgressSessionInput,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

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

const MEASUREMENT_TYPES = new Set<string>([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

function asMeasurementType(
  value: string,
): ExerciseMeasurementTypeForProgress | null {
  if (!MEASUREMENT_TYPES.has(value)) {
    return null;
  }
  return value as ExerciseMeasurementTypeForProgress;
}

type SessionExerciseRow = {
  id: string;
  sourceExerciseId: string | null;
  measurementTypeSnapshot: string;
  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  workoutSession: {
    id: string;
    localDate: Date;
    startedAt: Date;
  };
  sets: Array<{
    id: string;
    setType: string;
    status: string;
    actualWeightKg: unknown;
    actualReps: number | null;
    actualDurationSeconds: number | null;
    actualDistanceMeters: unknown;
  }>;
};

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getExerciseProgress(
    userId: string,
    exerciseId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ExerciseProgressResponse> {
    const exercise = await this.findAccessibleExerciseOrThrow(userId, exerciseId);

    const parsed = parseExerciseProgressQuery({
      metric: rawQuery.metric,
      from: rawQuery.from,
      to: rawQuery.to,
      equipmentId: rawQuery.equipmentId,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const query = parsed.data;

    const rows = await this.loadCompletedExerciseRows(userId, exerciseId, {
      from: query.from,
      to: query.to,
      equipmentId: query.equipmentId,
    });

    const measurementTypesPresent = new Set<ExerciseMeasurementTypeForProgress>();
    for (const row of rows) {
      const type = asMeasurementType(row.measurementTypeSnapshot);
      if (type) {
        measurementTypesPresent.add(type);
      }
    }

    const catalogType = asMeasurementType(exercise.measurementType);
    const availableMetrics =
      measurementTypesPresent.size > 0
        ? resolveAvailableProgressMetricsFromTypes([
            ...measurementTypesPresent,
          ])
        : catalogType
          ? resolveAvailableProgressMetrics(catalogType)
          : [];

    const defaultMetric =
      catalogType != null
        ? resolveDefaultProgressMetric(catalogType)
        : availableMetrics[0] ?? null;

    let selectedMetric: ExerciseProgressMetric | null =
      query.metric ?? defaultMetric;

    if (query.metric != null) {
      if (
        availableMetrics.length > 0 &&
        !availableMetrics.includes(query.metric)
      ) {
        throw new BadRequestException({
          code: 'PROGRESS_METRIC_NOT_SUPPORTED',
          message:
            'Cette métrique n’est pas compatible avec les performances enregistrées pour cet exercice.',
        });
      }
      selectedMetric = query.metric;
    } else if (
      selectedMetric != null &&
      availableMetrics.length > 0 &&
      !availableMetrics.includes(selectedMetric)
    ) {
      selectedMetric = availableMetrics[0] ?? null;
    }

    if (selectedMetric == null) {
      return {
        exercise: {
          id: exercise.id,
          name: exercise.name,
          archived: exercise.archivedAt != null,
        },
        availableMetrics,
        selectedMetric: null,
        range: {
          from: query.from ?? null,
          to: query.to ?? null,
        },
        summary: null,
        points: [],
      };
    }

    const sessions = this.groupRowsBySession(rows);
    const points: ExerciseProgressPoint[] = [];

    for (const session of sessions) {
      const point = computeExerciseWorkoutProgressPoint(session, selectedMetric);
      if (point) {
        points.push({
          workoutSessionId: point.workoutSessionId,
          workoutSessionExerciseIds: point.workoutSessionExerciseIds,
          localDate: point.localDate,
          startedAt: point.startedAt,
          value: point.value,
          context: {
            measurementType: point.context.measurementType,
            maxWeightKg: point.context.maxWeightKg,
            maxReps: point.context.maxReps,
            workingExternalVolumeKg: point.context.workingExternalVolumeKg,
            totalReps: point.context.totalReps,
            maxDurationSeconds: point.context.maxDurationSeconds,
            totalDurationSeconds: point.context.totalDurationSeconds,
            maxDistanceMeters: point.context.maxDistanceMeters,
            totalDistanceMeters: point.context.totalDistanceMeters,
            performedSetCount: point.context.performedSetCount,
            equipmentTypeId: point.context.equipmentTypeId,
            equipmentName: point.context.equipmentName,
          },
        });
      }
    }

    points.sort(compareExerciseProgressPointsAsc);

    if (points.length > EXERCISE_PROGRESS_MAX_POINTS) {
      throw new BadRequestException({
        code: 'PROGRESS_RANGE_TOO_LARGE',
        message: `Trop de points de progression (maximum ${EXERCISE_PROGRESS_MAX_POINTS}). Raccourcis la plage de dates.`,
      });
    }

    const summary =
      points.length === 0
        ? null
        : computeExerciseProgressSummary(points, selectedMetric);

    this.logger.debug(
      `progress exercise=${exerciseId} metric=${selectedMetric} points=${points.length}`,
    );

    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        archived: exercise.archivedAt != null,
      },
      availableMetrics,
      selectedMetric,
      range: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      summary,
      points,
    };
  }

  private async findAccessibleExerciseOrThrow(userId: string, exerciseId: string) {
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

  private async loadCompletedExerciseRows(
    userId: string,
    exerciseId: string,
    filters: {
      from?: string;
      to?: string;
      equipmentId?: string;
    },
  ): Promise<SessionExerciseRow[]> {
    const sessionWhere: Prisma.WorkoutSessionWhereInput = {
      ownerUserId: userId,
      status: 'COMPLETED',
    };
    if (filters.from || filters.to) {
      sessionWhere.localDate = {};
      if (filters.from) {
        sessionWhere.localDate.gte = localDateStringToUtcDate(filters.from);
      }
      if (filters.to) {
        sessionWhere.localDate.lte = localDateStringToUtcDate(filters.to);
      }
    }

    const where: Prisma.WorkoutSessionExerciseWhereInput = {
      sourceExerciseId: exerciseId,
      workoutSession: sessionWhere,
    };
    if (filters.equipmentId) {
      where.equipmentTypeId = filters.equipmentId;
    }

    const rows = await this.prisma.workoutSessionExercise.findMany({
      where,
      select: {
        id: true,
        sourceExerciseId: true,
        measurementTypeSnapshot: true,
        equipmentTypeId: true,
        equipmentNameSnapshot: true,
        workoutSession: {
          select: {
            id: true,
            localDate: true,
            startedAt: true,
          },
        },
        sets: {
          select: {
            id: true,
            setType: true,
            status: true,
            actualWeightKg: true,
            actualReps: true,
            actualDurationSeconds: true,
            actualDistanceMeters: true,
          },
        },
      },
      orderBy: [
        { workoutSession: { localDate: 'asc' } },
        { workoutSession: { startedAt: 'asc' } },
        { workoutSession: { id: 'asc' } },
        { position: 'asc' },
      ],
    });

    return rows as SessionExerciseRow[];
  }

  private groupRowsBySession(
    rows: SessionExerciseRow[],
  ): ExerciseProgressSessionInput[] {
    const bySession = new Map<string, ExerciseProgressSessionInput>();

    for (const row of rows) {
      const measurementType = asMeasurementType(row.measurementTypeSnapshot);
      if (!measurementType) {
        continue;
      }

      const sessionId = row.workoutSession.id;
      let session = bySession.get(sessionId);
      if (!session) {
        session = {
          workoutSessionId: sessionId,
          localDate: utcDateToLocalDateString(row.workoutSession.localDate),
          startedAt: row.workoutSession.startedAt.toISOString(),
          exercises: [],
        };
        bySession.set(sessionId, session);
      }

      const occurrence: ExerciseProgressOccurrenceInput = {
        id: row.id,
        measurementType,
        equipmentTypeId: row.equipmentTypeId,
        equipmentNameSnapshot: row.equipmentNameSnapshot,
        sets: row.sets.map((set) => ({
          id: set.id,
          setType: set.setType,
          status: set.status,
          actualWeightKg: decimalToNumber(set.actualWeightKg),
          actualReps: set.actualReps,
          actualDurationSeconds: set.actualDurationSeconds,
          actualDistanceMeters: decimalToNumber(set.actualDistanceMeters),
        })),
      };
      session.exercises.push(occurrence);
    }

    return [...bySession.values()];
  }
}
