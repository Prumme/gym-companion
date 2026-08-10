import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  EstimatedStrengthPoint,
  ExerciseProgressMetric,
  ExerciseProgressPoint,
  ExerciseProgressResponse,
  ExerciseStrengthResponse,
  ProgressOverviewResponse,
  WorkoutSetType,
} from '@gym-companion/shared';
import {
  EXERCISE_PROGRESS_MAX_POINTS,
  MAX_E1RM_REPS,
  MIN_E1RM_REPS,
  ONE_REP_MAX_FORMULA,
  PROGRESS_OVERVIEW_RECENT_RECORDS_LIMIT,
  buildProgressOverviewTimeline,
  compareExerciseProgressPointsAsc,
  compareStrengthPointsAsc,
  computeAverageWorkoutsPerWeek,
  computeBestEstimatedOneRepMaxForWorkout,
  computeExerciseProgressSummary,
  computeExerciseStrengthSummary,
  computeExerciseWorkoutProgressPoint,
  computeProgressOverviewComparison,
  computeProgressOverviewTotals,
  computeProgressTopExercises,
  isStrengthSupportedForMeasurement,
  localDateStringToUtcDate,
  parseExerciseProgressQuery,
  parseExerciseStrengthQuery,
  parseProgressOverviewQuery,
  resolveAvailableOverviewMetrics,
  resolveAvailableProgressMetrics,
  resolveAvailableProgressMetricsFromTypes,
  resolveDefaultOverviewMetric,
  resolveDefaultProgressMetric,
  resolvePreviousRange,
  resolveProgressOverviewBucket,
  utcDateToLocalDateString,
  type ExerciseMeasurementTypeForProgress,
  type ExerciseProgressOccurrenceInput,
  type ExerciseProgressSessionInput,
  type ProgressOverviewSessionInput,
  type StrengthOccurrenceInput,
  type StrengthSessionInput,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import { PersonalRecordsService } from '../personal-records/personal-records.service';

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

type StrengthExerciseRow = {
  id: string;
  sourceExerciseId: string | null;
  measurementTypeSnapshot: string;
  equipmentTypeId: string | null;
  workoutSession: {
    id: string;
    status: string;
    localDate: Date;
    startedAt: Date;
  };
  sets: Array<{
    id: string;
    setType: string;
    status: string;
    position: number;
    actualWeightKg: unknown;
    actualReps: number | null;
    actualRir: number | null;
    actualRpe: unknown;
    reachedFailure: boolean;
    completedAt: Date | null;
  }>;
};

type OverviewSessionRow = {
  id: string;
  localDate: Date;
  startedAt: Date;
  completedAt: Date | null;
  exercises: Array<{
    sourceExerciseId: string | null;
    exerciseNameSnapshot: string;
    measurementTypeSnapshot: string;
    sets: Array<{
      setType: string;
      status: string;
      actualWeightKg: unknown;
      actualReps: number | null;
      actualDurationSeconds: number | null;
      actualDistanceMeters: unknown;
      reachedFailure: boolean;
    }>;
  }>;
};

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly personalRecordsService: PersonalRecordsService,
  ) {}

  async getOverview(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ProgressOverviewResponse> {
    const parsed = parseProgressOverviewQuery({
      from: rawQuery.from,
      to: rawQuery.to,
      metric: rawQuery.metric,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const query = parsed.data;
    const rangeFrom = query.from ?? null;
    const rangeTo = query.to ?? null;

    const sessions = await this.loadCompletedSessionsForOverview(userId, {
      from: query.from,
      to: query.to,
    });
    const sessionInputs = this.mapOverviewSessions(sessions);
    const totals = computeProgressOverviewTotals(sessionInputs);

    const activeDays = new Set(sessionInputs.map((session) => session.localDate));
    const frequency = {
      activeDayCount: activeDays.size,
      averageWorkoutsPerWeek: computeAverageWorkoutsPerWeek(
        totals.workoutCount,
        rangeFrom,
        rangeTo,
      ),
    };

    let timelineFrom = rangeFrom;
    let timelineTo = rangeTo;
    if (!timelineFrom || !timelineTo) {
      if (sessionInputs.length === 0) {
        timelineFrom = null;
        timelineTo = null;
      } else {
        const dates = sessionInputs.map((session) => session.localDate).sort();
        timelineFrom = dates[0]!;
        timelineTo = dates[dates.length - 1]!;
      }
    }

    const bucket =
      timelineFrom && timelineTo
        ? resolveProgressOverviewBucket(timelineFrom, timelineTo)
        : 'DAY';
    const points =
      timelineFrom && timelineTo
        ? buildProgressOverviewTimeline(
            sessionInputs,
            timelineFrom,
            timelineTo,
            bucket,
          )
        : [];

    const availableMetrics = resolveAvailableOverviewMetrics(totals);
    const selectedMetric = resolveDefaultOverviewMetric(
      availableMetrics,
      query.metric,
    );

    let comparison: ProgressOverviewResponse['comparison'] = null;
    if (rangeFrom && rangeTo) {
      const previousRange = resolvePreviousRange(rangeFrom, rangeTo);
      const previousSessions = await this.loadCompletedSessionsForOverview(
        userId,
        previousRange,
      );
      const previousTotals = computeProgressOverviewTotals(
        this.mapOverviewSessions(previousSessions),
      );
      comparison = computeProgressOverviewComparison(totals, previousTotals);
    }

    const allRecords =
      await this.personalRecordsService.listCurrentRecords(userId);
    const recentRecords = allRecords
      .filter((record) => {
        if (rangeFrom && record.achievedOn < rangeFrom) {
          return false;
        }
        if (rangeTo && record.achievedOn > rangeTo) {
          return false;
        }
        return true;
      })
      .slice(0, PROGRESS_OVERVIEW_RECENT_RECORDS_LIMIT);

    const topExercises = computeProgressTopExercises(sessionInputs);

    this.logger.debug(
      `progress overview workouts=${totals.workoutCount} bucket=${bucket} points=${points.length}`,
    );

    return {
      range: { from: rangeFrom, to: rangeTo },
      availableMetrics,
      selectedMetric,
      totals,
      frequency,
      comparison,
      timeline: { bucket, points },
      recentRecords,
      topExercises,
    };
  }

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

  async getExerciseStrengthProgress(
    userId: string,
    exerciseId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ExerciseStrengthResponse> {
    const exercise = await this.findAccessibleExerciseOrThrow(userId, exerciseId);

    const parsed = parseExerciseStrengthQuery({
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
    const range = {
      from: query.from ?? null,
      to: query.to ?? null,
    };

    const supported = isStrengthSupportedForMeasurement(exercise.measurementType);
    if (!supported) {
      return {
        exercise: {
          id: exercise.id,
          name: exercise.name,
          archived: exercise.archivedAt != null,
        },
        supported: false,
        formula: ONE_REP_MAX_FORMULA,
        eligibility: { minReps: MIN_E1RM_REPS, maxReps: MAX_E1RM_REPS },
        range,
        summary: null,
        points: [],
      };
    }

    const rows = await this.loadCompletedStrengthRows(userId, exerciseId, {
      from: query.from,
      to: query.to,
      equipmentId: query.equipmentId,
    });

    const sessions = this.groupStrengthRowsBySession(rows);
    const points: EstimatedStrengthPoint[] = [];

    for (const session of sessions) {
      const point = computeBestEstimatedOneRepMaxForWorkout(session);
      if (!point || !Number.isFinite(point.estimatedOneRepMaxKg)) {
        continue;
      }
      points.push({
        workoutSessionId: point.workoutSessionId,
        workoutSessionExerciseIds: point.workoutSessionExerciseIds,
        localDate: point.localDate,
        startedAt: point.startedAt,
        estimatedOneRepMaxKg: point.estimatedOneRepMaxKg,
        sourceSet: {
          workoutSessionExerciseId: point.sourceSet.workoutSessionExerciseId,
          workoutSetId: point.sourceSet.workoutSetId,
          weightKg: point.sourceSet.weightKg,
          reps: point.sourceSet.reps,
          rir: point.sourceSet.rir,
          rpe: point.sourceSet.rpe,
          reachedFailure: point.sourceSet.reachedFailure,
          setType: point.sourceSet.setType as WorkoutSetType,
        },
      });
    }

    points.sort(compareStrengthPointsAsc);

    if (points.length > EXERCISE_PROGRESS_MAX_POINTS) {
      throw new BadRequestException({
        code: 'PROGRESS_RANGE_TOO_LARGE',
        message: `Trop de points de force estimée (maximum ${EXERCISE_PROGRESS_MAX_POINTS}). Raccourcis la plage de dates.`,
      });
    }

    const summaryComputed = computeExerciseStrengthSummary(points);
    const summary =
      summaryComputed.pointCount === 0
        ? null
        : {
            ...summaryComputed,
            latestSource: summaryComputed.latestSource
              ? {
                  ...summaryComputed.latestSource,
                  setType: summaryComputed.latestSource
                    .setType as WorkoutSetType,
                }
              : null,
            bestSource: summaryComputed.bestSource
              ? {
                  ...summaryComputed.bestSource,
                  setType: summaryComputed.bestSource.setType as WorkoutSetType,
                }
              : null,
          };

    this.logger.debug(
      `strength exercise=${exerciseId} points=${points.length}`,
    );

    return {
      exercise: {
        id: exercise.id,
        name: exercise.name,
        archived: exercise.archivedAt != null,
      },
      supported: true,
      formula: ONE_REP_MAX_FORMULA,
      eligibility: { minReps: MIN_E1RM_REPS, maxReps: MAX_E1RM_REPS },
      range,
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

  private async loadCompletedStrengthRows(
    userId: string,
    exerciseId: string,
    filters: {
      from?: string;
      to?: string;
      equipmentId?: string;
    },
  ): Promise<StrengthExerciseRow[]> {
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
      measurementTypeSnapshot: 'WEIGHT_REPS',
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
        workoutSession: {
          select: {
            id: true,
            status: true,
            localDate: true,
            startedAt: true,
          },
        },
        sets: {
          select: {
            id: true,
            setType: true,
            status: true,
            position: true,
            actualWeightKg: true,
            actualReps: true,
            actualRir: true,
            actualRpe: true,
            reachedFailure: true,
            completedAt: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [
        { workoutSession: { localDate: 'asc' } },
        { workoutSession: { startedAt: 'asc' } },
        { workoutSession: { id: 'asc' } },
        { position: 'asc' },
      ],
    });

    return rows as StrengthExerciseRow[];
  }

  private groupStrengthRowsBySession(
    rows: StrengthExerciseRow[],
  ): StrengthSessionInput[] {
    const bySession = new Map<string, StrengthSessionInput>();

    for (const row of rows) {
      const sessionId = row.workoutSession.id;
      let session = bySession.get(sessionId);
      if (!session) {
        session = {
          workoutSessionId: sessionId,
          sessionStatus: row.workoutSession.status,
          localDate: utcDateToLocalDateString(row.workoutSession.localDate),
          startedAt: row.workoutSession.startedAt.toISOString(),
          exercises: [],
        };
        bySession.set(sessionId, session);
      }

      const occurrence: StrengthOccurrenceInput = {
        id: row.id,
        sourceExerciseId: row.sourceExerciseId,
        measurementType: row.measurementTypeSnapshot,
        equipmentTypeId: row.equipmentTypeId,
        sets: row.sets.map((set) => ({
          id: set.id,
          setType: set.setType,
          status: set.status,
          position: set.position,
          actualWeightKg: decimalToNumber(set.actualWeightKg),
          actualReps: set.actualReps,
          actualRir: set.actualRir,
          actualRpe: decimalToNumber(set.actualRpe),
          reachedFailure: set.reachedFailure,
          completedAt: set.completedAt?.toISOString() ?? null,
        })),
      };
      session.exercises.push(occurrence);
    }

    return [...bySession.values()];
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

  private async loadCompletedSessionsForOverview(
    userId: string,
    filters: { from?: string; to?: string },
  ): Promise<OverviewSessionRow[]> {
    const where: Prisma.WorkoutSessionWhereInput = {
      ownerUserId: userId,
      status: 'COMPLETED',
    };
    if (filters.from || filters.to) {
      where.localDate = {};
      if (filters.from) {
        where.localDate.gte = localDateStringToUtcDate(filters.from);
      }
      if (filters.to) {
        where.localDate.lte = localDateStringToUtcDate(filters.to);
      }
    }

    const rows = await this.prisma.workoutSession.findMany({
      where,
      select: {
        id: true,
        localDate: true,
        startedAt: true,
        completedAt: true,
        exercises: {
          select: {
            sourceExerciseId: true,
            exerciseNameSnapshot: true,
            measurementTypeSnapshot: true,
            sets: {
              select: {
                setType: true,
                status: true,
                actualWeightKg: true,
                actualReps: true,
                actualDurationSeconds: true,
                actualDistanceMeters: true,
                reachedFailure: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ localDate: 'asc' }, { startedAt: 'asc' }, { id: 'asc' }],
    });

    return rows as OverviewSessionRow[];
  }

  private mapOverviewSessions(
    rows: OverviewSessionRow[],
  ): ProgressOverviewSessionInput[] {
    return rows.map((row) => ({
      workoutSessionId: row.id,
      localDate: utcDateToLocalDateString(row.localDate),
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      exercises: row.exercises.map((exercise) => ({
        sourceExerciseId: exercise.sourceExerciseId,
        exerciseNameSnapshot: exercise.exerciseNameSnapshot,
        measurementType: exercise.measurementTypeSnapshot,
        sets: exercise.sets.map((set) => ({
          setType: set.setType,
          status: set.status,
          actualWeightKg: decimalToNumber(set.actualWeightKg),
          actualReps: set.actualReps,
          actualDurationSeconds: set.actualDurationSeconds,
          actualDistanceMeters: decimalToNumber(set.actualDistanceMeters),
          reachedFailure: set.reachedFailure,
        })),
      })),
    }));
  }
}
