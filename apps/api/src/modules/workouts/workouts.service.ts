import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createWorkoutSessionSchema,
  localDateStringToUtcDate,
  updateWorkoutSetSchema,
  validateWorkoutSetActuals,
} from '@gym-companion/validation';
import type {
  UpdateWorkoutSetResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  buildWorkoutSessionSnapshotFromTemplate,
  type TemplateForSnapshot,
} from './workout-snapshot';
import {
  toWorkoutSetDetail,
  toWorkoutSessionDetail,
  type WorkoutSetSnapshotRow,
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

function actualPayloadEqual(
  set: {
    status: string;
    actualWeightKg: unknown;
    actualReps: number | null;
    actualDurationSeconds: number | null;
    actualDistanceMeters: unknown;
    actualRir: number | null;
    actualRpe: unknown;
    reachedFailure: boolean;
    notes: string | null;
  },
  normalized: {
    status: string;
    actualWeightKg: number | null;
    actualReps: number | null;
    actualDurationSeconds: number | null;
    actualDistanceMeters: number | null;
    actualRir: number | null;
    actualRpe: number | null;
    reachedFailure: boolean;
    notes: string | null;
  },
): boolean {
  const toNum = (value: unknown) =>
    value == null ? null : typeof value === 'number' ? value : Number(value);

  return (
    set.status === normalized.status &&
    toNum(set.actualWeightKg) === normalized.actualWeightKg &&
    set.actualReps === normalized.actualReps &&
    set.actualDurationSeconds === normalized.actualDurationSeconds &&
    toNum(set.actualDistanceMeters) === normalized.actualDistanceMeters &&
    set.actualRir === normalized.actualRir &&
    toNum(set.actualRpe) === normalized.actualRpe &&
    set.reachedFailure === normalized.reachedFailure &&
    set.notes === normalized.notes
  );
}

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
                    status: 'PENDING',
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

  async updateSet(
    userId: string,
    workoutSessionId: string,
    sessionExerciseId: string,
    workoutSetId: string,
    input: unknown,
  ): Promise<UpdateWorkoutSetResult> {
    const data = updateWorkoutSetSchema.parse(input);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.workoutSession.findFirst({
          where: { id: workoutSessionId, ownerUserId: userId },
          select: {
            id: true,
            status: true,
            version: true,
          },
        });

        if (!session) {
          throw new NotFoundException({
            code: 'WORKOUT_NOT_FOUND',
            message: 'Séance introuvable.',
          });
        }

        if (session.status !== 'ACTIVE' && session.status !== 'PAUSED') {
          throw new BadRequestException({
            code: 'WORKOUT_NOT_EDITABLE',
            message: 'Cette séance n’est plus modifiable.',
          });
        }

        if (session.version !== data.expectedVersion) {
          throw new ConflictException({
            code: 'WORKOUT_VERSION_CONFLICT',
            message:
              'La séance a été modifiée depuis un autre onglet ou appareil.',
            details: { currentVersion: session.version },
          });
        }

        const exercise = await tx.workoutSessionExercise.findFirst({
          where: {
            id: sessionExerciseId,
            workoutSessionId: session.id,
          },
          select: {
            id: true,
            measurementTypeSnapshot: true,
          },
        });

        if (!exercise) {
          throw new NotFoundException({
            code: 'WORKOUT_SET_NOT_FOUND',
            message: 'Série introuvable.',
          });
        }

        const set = await tx.workoutSet.findFirst({
          where: {
            id: workoutSetId,
            workoutSessionExerciseId: exercise.id,
            ownerUserId: userId,
          },
        });

        if (!set) {
          throw new NotFoundException({
            code: 'WORKOUT_SET_NOT_FOUND',
            message: 'Série introuvable.',
          });
        }

        const actualValidation = validateWorkoutSetActuals(
          exercise.measurementTypeSnapshot,
          {
            status: data.status,
            actualWeightKg: data.actualWeightKg,
            actualReps: data.actualReps,
            actualDurationSeconds: data.actualDurationSeconds,
            actualDistanceMeters: data.actualDistanceMeters,
            actualRir: data.actualRir,
            actualRpe: data.actualRpe,
            reachedFailure: data.reachedFailure,
            notes:
              typeof data.notes === 'string' && data.notes.trim() === ''
                ? null
                : data.notes,
          },
        );

        if (!actualValidation.ok) {
          throw new BadRequestException({
            code: actualValidation.code,
            message: actualValidation.message,
          });
        }

        const normalized = actualValidation.normalized;

        if (data.clientCommandId) {
          const existingCommand = await tx.workoutSet.findFirst({
            where: {
              ownerUserId: userId,
              clientCommandId: data.clientCommandId,
            },
          });

          if (existingCommand) {
            if (existingCommand.id !== set.id) {
              throw new ConflictException({
                code: 'WORKOUT_SET_COMMAND_CONFLICT',
                message:
                  'Cet identifiant de commande est déjà utilisé pour une autre série.',
              });
            }
            if (actualPayloadEqual(existingCommand, normalized)) {
              return {
                workoutSet: toWorkoutSetDetail(
                  existingCommand as WorkoutSetSnapshotRow,
                ),
                workoutSessionVersion: session.version,
              };
            }
            throw new ConflictException({
              code: 'WORKOUT_SET_COMMAND_CONFLICT',
              message:
                'Cet identifiant de commande a déjà été utilisé avec un autre payload.',
            });
          }
        }

        const now = new Date();
        const isFinalized =
          normalized.status === 'COMPLETED' ||
          normalized.status === 'PARTIAL' ||
          normalized.status === 'FAILED' ||
          normalized.status === 'SKIPPED';

        const updatedSet = await tx.workoutSet.update({
          where: { id: set.id },
          data: {
            status: normalized.status,
            actualWeightKg: normalized.actualWeightKg,
            actualReps: normalized.actualReps,
            actualDurationSeconds: normalized.actualDurationSeconds,
            actualDistanceMeters: normalized.actualDistanceMeters,
            actualRir: normalized.actualRir,
            actualRpe: normalized.actualRpe,
            reachedFailure: normalized.reachedFailure,
            notes: normalized.notes,
            startedAt:
              set.startedAt ??
              (normalized.status !== 'PENDING' ? now : null),
            completedAt: isFinalized
              ? now
              : normalized.status === 'PENDING'
                ? null
                : set.completedAt,
            clientCommandId: data.clientCommandId ?? set.clientCommandId,
          },
        });

        const updatedSession = await tx.workoutSession.update({
          where: { id: session.id },
          data: { version: { increment: 1 } },
          select: { version: true },
        });

        return {
          workoutSet: toWorkoutSetDetail(updatedSet as WorkoutSetSnapshotRow),
          workoutSessionVersion: updatedSession.version,
        };
      });
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
        throw new ConflictException({
          code: 'WORKOUT_SET_DUPLICATE_COMMAND',
          message: 'Identifiant de commande déjà utilisé.',
        });
      }
      throw error;
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
