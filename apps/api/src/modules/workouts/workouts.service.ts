import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createWorkoutSessionSchema,
  localDateStringToUtcDate,
} from '@gym-companion/validation';
import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  buildWorkoutSessionSnapshotFromTemplate,
  type TemplateForSnapshot,
} from './workout-snapshot';
import {
  toWorkoutSessionDetail,
  type WorkoutSessionSnapshotRow,
} from './workouts.mapper';

const sessionDetailInclude = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      sets: {
        orderBy: { position: 'asc' as const },
      },
    },
  },
} satisfies Prisma.WorkoutSessionInclude;

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(userId: string): Promise<WorkoutSessionDetail | null> {
    const row = await this.prisma.workoutSession.findFirst({
      where: {
        ownerUserId: userId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      include: sessionDetailInclude,
    });
    if (!row) {
      return null;
    }
    return toWorkoutSessionDetail(row as WorkoutSessionSnapshotRow);
  }

  async getById(
    userId: string,
    workoutSessionId: string,
  ): Promise<WorkoutSessionDetail> {
    const row = await this.findOwnedOrThrow(userId, workoutSessionId);
    return toWorkoutSessionDetail(row as WorkoutSessionSnapshotRow);
  }

  async create(
    userId: string,
    input: unknown,
  ): Promise<WorkoutSessionDetail> {
    const data = createWorkoutSessionSchema.parse(input);

    const template = await this.loadStartableTemplateOrThrow(
      userId,
      data.sourceWorkoutTemplateId,
    );

    const built = buildWorkoutSessionSnapshotFromTemplate(template);
    if (!built.ok) {
      throw new BadRequestException({
        code: built.error.code,
        message: built.error.message,
      });
    }

    const snapshot = built.snapshot;
    const localDate = localDateStringToUtcDate(data.localDate);
    const startedAt = new Date();

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.workoutSession.findFirst({
          where: {
            ownerUserId: userId,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            code: 'WORKOUT_ACTIVE_ALREADY_EXISTS',
            message: 'Une séance est déjà en cours.',
            details: { activeWorkoutSessionId: existing.id },
          });
        }

        const session = await tx.workoutSession.create({
          data: {
            ownerUserId: userId,
            sourceProgramId: snapshot.sourceProgramId,
            sourceWorkoutTemplateId: snapshot.sourceWorkoutTemplateId,
            programNameSnapshot: snapshot.programNameSnapshot,
            workoutTemplateNameSnapshot: snapshot.workoutTemplateNameSnapshot,
            name: snapshot.name,
            status: 'ACTIVE',
            localDate,
            timezone: data.timezone,
            startedAt,
            version: 1,
            exercises: {
              create: snapshot.exercises.map((exercise) => ({
                sourceExerciseId: exercise.sourceExerciseId,
                sourceTemplateExerciseId: exercise.sourceTemplateExerciseId,
                exerciseNameSnapshot: exercise.exerciseNameSnapshot,
                measurementTypeSnapshot: exercise.measurementTypeSnapshot,
                position: exercise.position,
                primaryMuscleGroupNameSnapshot:
                  exercise.primaryMuscleGroupNameSnapshot,
                sourceExerciseArchivedAtCreation:
                  exercise.sourceExerciseArchivedAtCreation,
                equipmentTypeId: exercise.equipmentTypeId,
                equipmentNameSnapshot: exercise.equipmentNameSnapshot,
                equipmentCodeSnapshot: exercise.equipmentCodeSnapshot,
                notesSnapshot: exercise.notesSnapshot,
                restSecondsSnapshot: exercise.restSecondsSnapshot,
                sets: {
                  create: exercise.sets.map((set) => ({
                    ownerUserId: userId,
                    sourceTemplateSetId: set.sourceTemplateSetId,
                    position: set.position,
                    setType: set.setType,
                    status: null,
                    targetWeightKg: set.targetWeightKg,
                    targetRepMin: set.targetRepMin,
                    targetRepMax: set.targetRepMax,
                    targetDurationSeconds: set.targetDurationSeconds,
                    targetDistanceMeters: set.targetDistanceMeters,
                    targetIntensityPercent: set.targetIntensityPercent,
                    targetRir: set.targetRir,
                    targetRpe: set.targetRpe,
                    targetRestSeconds: set.targetRestSeconds,
                  })),
                },
              })),
            },
          },
          include: sessionDetailInclude,
        });

        return session;
      });

      return toWorkoutSessionDetail(created as WorkoutSessionSnapshotRow);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const active = await this.prisma.workoutSession.findFirst({
          where: {
            ownerUserId: userId,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
          select: { id: true },
        });
        throw new ConflictException({
          code: 'WORKOUT_ACTIVE_ALREADY_EXISTS',
          message: 'Une séance est déjà en cours.',
          details: active
            ? { activeWorkoutSessionId: active.id }
            : undefined,
        });
      }
      throw new BadRequestException({
        code: 'WORKOUT_SNAPSHOT_CREATION_FAILED',
        message: 'La création du snapshot de séance a échoué.',
      });
    }
  }

  private async loadStartableTemplateOrThrow(
    userId: string,
    sourceWorkoutTemplateId: string,
  ): Promise<TemplateForSnapshot> {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: {
        id: sourceWorkoutTemplateId,
        ownerUserId: userId,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            ownerUserId: true,
            archivedAt: true,
          },
        },
        exercises: {
          orderBy: { position: 'asc' },
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                measurementType: true,
                archivedAt: true,
                primaryMuscleGroup: {
                  select: { name: true },
                },
              },
            },
            equipmentType: {
              select: { id: true, code: true, name: true },
            },
            sets: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!template || template.program.ownerUserId !== userId) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_NOT_FOUND',
        message: 'Modèle de séance introuvable.',
      });
    }

    if (template.program.archivedAt) {
      throw new BadRequestException({
        code: 'WORKOUT_TEMPLATE_NOT_STARTABLE',
        message:
          'Impossible de démarrer une séance depuis un programme archivé.',
      });
    }

    return template as TemplateForSnapshot;
  }

  private async findOwnedOrThrow(userId: string, workoutSessionId: string) {
    const row = await this.prisma.workoutSession.findFirst({
      where: { id: workoutSessionId, ownerUserId: userId },
      include: sessionDetailInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'WORKOUT_NOT_FOUND',
        message: 'Séance introuvable.',
      });
    }
    return row;
  }
}
