import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  PersonalRecord,
  PersonalRecordListResponse,
} from '@gym-companion/shared';
import {
  comparePersonalRecordsSort,
  decodePersonalRecordsCursor,
  encodePersonalRecordsCursor,
  getPersonalRecordPrincipalValue,
  isPersonalRecordAfterCursor,
  parsePersonalRecordsQuery,
  resolveRecordTypesForMeasurement,
  selectCurrentPersonalRecordsWithType,
  utcDateToLocalDateString,
  type ExerciseMeasurementTypeForRecords,
  type PersonalRecordCandidate,
  type PersonalRecordType,
  type WorkoutSetTypeForRecords,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toPersonalRecord,
  type CatalogExerciseInfo,
} from './personal-records.mapper';

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

type EligibleSetRow = {
  id: string;
  setType: string;
  actualWeightKg: unknown;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: unknown;
  actualRir: number | null;
  actualRpe: unknown;
  reachedFailure: boolean;
  completedAt: Date | null;
  workoutSessionExercise: {
    id: string;
    sourceExerciseId: string | null;
    exerciseNameSnapshot: string;
    measurementTypeSnapshot: string;
    equipmentTypeId: string | null;
    equipmentNameSnapshot: string | null;
    workoutSession: {
      id: string;
      localDate: Date;
    };
  };
};

@Injectable()
export class PersonalRecordsService {
  private readonly logger = new Logger(PersonalRecordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<PersonalRecordListResponse> {
    const parsed = parsePersonalRecordsQuery(rawQuery);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const query = parsed.data;

    let cursorPayload:
      | ReturnType<typeof decodePersonalRecordsCursor>
      | undefined;
    if (query.cursor) {
      try {
        cursorPayload = decodePersonalRecordsCursor(query.cursor);
      } catch {
        throw new BadRequestException({
          code: 'PERSONAL_RECORD_INVALID_CURSOR',
          message: 'Cursor de pagination invalide.',
        });
      }
    }

    const records = await this.computeRecords(userId, {
      exerciseId: query.exerciseId,
      recordType: query.recordType,
    });

    let filtered = records;
    if (cursorPayload) {
      filtered = records.filter((record) =>
        isPersonalRecordAfterCursor(
          {
            achievedOn: record.achievedOn,
            exerciseId: record.exerciseId,
            equipmentTypeId: record.equipment.id,
            recordType: record.recordType,
          },
          cursorPayload!,
        ),
      );
    }

    const hasMore = filtered.length > query.limit;
    const page = hasMore ? filtered.slice(0, query.limit) : filtered;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodePersonalRecordsCursor({
            version: 1,
            achievedOn: last.achievedOn,
            exerciseId: last.exerciseId,
            equipmentTypeId: last.equipment.id,
            recordType: last.recordType,
          })
        : null;

    return {
      data: page,
      pagination: { nextCursor, hasMore },
    };
  }

  async listForExercise(
    userId: string,
    exerciseId: string,
  ): Promise<PersonalRecord[]> {
    await this.assertExerciseAccessible(userId, exerciseId);
    return this.computeRecords(userId, { exerciseId });
  }

  /** Records courants (calcul 4.1) — réutilisé par le dashboard 4.4. */
  async listCurrentRecords(userId: string): Promise<PersonalRecord[]> {
    return this.computeRecords(userId, {});
  }

  private async assertExerciseAccessible(userId: string, exerciseId: string) {
    const row = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }
  }

  /**
   * Charge les séries éligibles via Prisma (filtres ciblés), puis agrège
   * en mémoire. Pas de table PersonalRecord : les séances COMPLETED restent
   * la source de vérité (jalon 4.1).
   */
  private async computeRecords(
    userId: string,
    filters: {
      exerciseId?: string;
      recordType?: PersonalRecordType;
    },
  ): Promise<PersonalRecord[]> {
    const where: Prisma.WorkoutSetWhereInput = {
      ownerUserId: userId,
      status: 'COMPLETED',
      setType: { not: 'WARMUP' },
      workoutSessionExercise: {
        sourceExerciseId: filters.exerciseId
          ? filters.exerciseId
          : { not: null },
        workoutSession: {
          ownerUserId: userId,
          status: 'COMPLETED',
        },
      },
    };

    const rows = (await this.prisma.workoutSet.findMany({
      where,
      select: {
        id: true,
        setType: true,
        actualWeightKg: true,
        actualReps: true,
        actualDurationSeconds: true,
        actualDistanceMeters: true,
        actualRir: true,
        actualRpe: true,
        reachedFailure: true,
        completedAt: true,
        workoutSessionExercise: {
          select: {
            id: true,
            sourceExerciseId: true,
            exerciseNameSnapshot: true,
            measurementTypeSnapshot: true,
            equipmentTypeId: true,
            equipmentNameSnapshot: true,
            workoutSession: {
              select: {
                id: true,
                localDate: true,
              },
            },
          },
        },
      },
    })) as EligibleSetRow[];

    const candidates: PersonalRecordCandidate[] = [];
    for (const row of rows) {
      const exercise = row.workoutSessionExercise;
      if (exercise.sourceExerciseId == null) {
        continue;
      }

      const candidate: PersonalRecordCandidate = {
        workoutSetId: row.id,
        workoutSessionExerciseId: exercise.id,
        workoutSessionId: exercise.workoutSession.id,
        sourceExerciseId: exercise.sourceExerciseId,
        exerciseNameSnapshot: exercise.exerciseNameSnapshot,
        measurementTypeSnapshot:
          exercise.measurementTypeSnapshot as ExerciseMeasurementTypeForRecords,
        equipmentTypeId: exercise.equipmentTypeId,
        equipmentNameSnapshot: exercise.equipmentNameSnapshot,
        setType: row.setType as WorkoutSetTypeForRecords,
        actualWeightKg: decimalToNumber(row.actualWeightKg),
        actualReps: row.actualReps,
        actualDurationSeconds: row.actualDurationSeconds,
        actualDistanceMeters: decimalToNumber(row.actualDistanceMeters),
        actualRir: row.actualRir,
        actualRpe: decimalToNumber(row.actualRpe),
        reachedFailure: row.reachedFailure,
        achievedOn: utcDateToLocalDateString(exercise.workoutSession.localDate),
        achievedAt: row.completedAt ? row.completedAt.toISOString() : null,
      };

      this.logIncoherentCompletedSet(candidate);
      candidates.push(candidate);
    }

    let selected = selectCurrentPersonalRecordsWithType(candidates);
    if (filters.recordType) {
      selected = selected.filter(
        (entry) => entry.recordType === filters.recordType,
      );
    }

    const exerciseIds = [
      ...new Set(selected.map((entry) => entry.candidate.sourceExerciseId)),
    ];
    const catalogRows =
      exerciseIds.length > 0
        ? await this.prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            select: {
              id: true,
              name: true,
              measurementType: true,
              archivedAt: true,
            },
          })
        : [];
    const catalogById = new Map<string, CatalogExerciseInfo>(
      catalogRows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          measurementType: row.measurementType,
          archivedAt: row.archivedAt,
        },
      ]),
    );

    const mapped = selected.map((entry) =>
      toPersonalRecord(
        entry.recordType,
        entry.candidate,
        catalogById.get(entry.candidate.sourceExerciseId) ?? null,
      ),
    );

    mapped.sort((a, b) =>
      comparePersonalRecordsSort(
        {
          achievedOn: a.achievedOn,
          exerciseId: a.exerciseId,
          equipmentTypeId: a.equipment.id,
          recordType: a.recordType,
        },
        {
          achievedOn: b.achievedOn,
          exerciseId: b.exerciseId,
          equipmentTypeId: b.equipment.id,
          recordType: b.recordType,
        },
      ),
    );

    return mapped;
  }

  private logIncoherentCompletedSet(candidate: PersonalRecordCandidate) {
    const types = resolveRecordTypesForMeasurement(
      candidate.measurementTypeSnapshot,
    );
    const missingAll = types.every(
      (type) => getPersonalRecordPrincipalValue(type, candidate) == null,
    );
    if (missingAll) {
      this.logger.warn(
        `Série COMPLETED sans valeur principale utilisable pour un record (set=${candidate.workoutSetId}, measurement=${candidate.measurementTypeSnapshot}). Ignorée.`,
      );
    }
  }
}
