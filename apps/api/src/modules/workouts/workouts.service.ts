import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  buildWorkoutHistoryCursorFilter,
  buildWorkoutLifecycleFingerprint,
  buildWorkoutSetCommandFingerprint,
  cancelWorkoutSessionSchema,
  completeWorkoutSessionSchema,
  createWorkoutSessionSchema,
  decodeWorkoutHistoryCursor,
  encodeWorkoutHistoryCursor,
  localDateStringToUtcDate,
  normalizeOptionalPlainText,
  parseWorkoutHistoryQuery,
  pauseWorkoutSessionSchema,
  replaceWorkoutSessionExerciseSchema,
  resolveWorkoutLifecycleTransition,
  resumeWorkoutSessionSchema,
  updateWorkoutSetSchema,
  utcDateToLocalDateString,
  validateWorkoutSetActuals,
  type WorkoutLifecycleAction,
} from '@gym-companion/validation';
import type {
  UpdateWorkoutSetResult,
  WorkoutHistoryListResponse,
  WorkoutLifecycleResult,
  WorkoutSessionDetail,
} from '@gym-companion/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import { SharedWorkoutSessionLinkNotifier } from '../shared-workouts/shared-workout-session-link.notifier';
import {
  buildWorkoutSessionSnapshotFromTemplate,
  type TemplateForSnapshot,
} from './workout-snapshot';
import {
  toWorkoutHistoryListItem,
  toWorkoutSetDetail,
  toWorkoutSessionDetail,
  type WorkoutHistoryListRow,
  type WorkoutSetSnapshotRow,
  type WorkoutSessionSnapshotRow,
} from './workouts.mapper';

export const workoutSessionDetailInclude = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      sets: {
        orderBy: { position: 'asc' as const },
      },
    },
  },
} satisfies Prisma.WorkoutSessionInclude;

const sessionDetailInclude = workoutSessionDetailInclude;

export type CreateWorkoutSessionInTxParams = {
  sourceWorkoutTemplateId: string;
  localDate: string;
  timezone: string;
};

const historyListInclude = {
  _count: { select: { exercises: true } },
  exercises: {
    select: {
      measurementTypeSnapshot: true,
      sets: {
        select: {
          status: true,
          setType: true,
          actualWeightKg: true,
          actualReps: true,
          actualDurationSeconds: true,
          actualDistanceMeters: true,
          reachedFailure: true,
        },
      },
    },
  },
} satisfies Prisma.WorkoutSessionInclude;

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SharedWorkoutSessionLinkNotifier))
    private readonly sharedSessionLinkNotifier: SharedWorkoutSessionLinkNotifier,
  ) {}

  async listHistory(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<WorkoutHistoryListResponse> {
    const parsed = parseWorkoutHistoryQuery(rawQuery);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    const query = parsed.data;

    let cursorFilter:
      | ReturnType<typeof buildWorkoutHistoryCursorFilter>
      | undefined;
    if (query.cursor) {
      try {
        cursorFilter = buildWorkoutHistoryCursorFilter(
          decodeWorkoutHistoryCursor(query.cursor),
        );
      } catch {
        throw new BadRequestException({
          code: 'WORKOUT_HISTORY_INVALID_CURSOR',
          message: 'Cursor de pagination invalide.',
        });
      }
    }

    const statusFilter: Prisma.WorkoutSessionWhereInput = query.status
      ? { status: query.status }
      : { status: { in: ['COMPLETED', 'CANCELLED'] } };

    const filters: Prisma.WorkoutSessionWhereInput[] = [
      { ownerUserId: userId },
      statusFilter,
    ];

    if (query.from) {
      filters.push({
        localDate: { gte: localDateStringToUtcDate(query.from) },
      });
    }
    if (query.to) {
      filters.push({
        localDate: { lte: localDateStringToUtcDate(query.to) },
      });
    }
    if (query.programId) {
      filters.push({ sourceProgramId: query.programId });
    }
    if (query.workoutTemplateId) {
      filters.push({ sourceWorkoutTemplateId: query.workoutTemplateId });
    }
    if (cursorFilter) {
      filters.push(cursorFilter);
    }

    const rows = await this.prisma.workoutSession.findMany({
      where: { AND: filters },
      include: historyListInclude,
      orderBy: [
        { localDate: 'desc' },
        { startedAt: 'desc' },
        { id: 'desc' },
      ],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeWorkoutHistoryCursor({
            version: 1,
            localDate: utcDateToLocalDateString(last.localDate),
            startedAt: last.startedAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      data: pageRows.map((row) =>
        toWorkoutHistoryListItem(row as WorkoutHistoryListRow),
      ),
      pagination: { nextCursor, hasMore },
    };
  }

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
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        return this.createFromTemplateInTransaction(tx, userId, data);
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

  /**
   * Source unique de création de snapshot (Phase 3 + Shared 5.4).
   * Peut s’exécuter dans une transaction externe (association room).
   */
  async createFromTemplateInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    params: CreateWorkoutSessionInTxParams,
  ) {
    const template = await this.loadStartableTemplateOrThrow(
      userId,
      params.sourceWorkoutTemplateId,
      tx,
    );

    const built = buildWorkoutSessionSnapshotFromTemplate(template);
    if (!built.ok) {
      throw new BadRequestException({
        code: built.error.code,
        message: built.error.message,
      });
    }

    const snapshot = built.snapshot;
    const localDate = localDateStringToUtcDate(params.localDate);
    const startedAt = new Date();

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

    return tx.workoutSession.create({
      data: {
        ownerUserId: userId,
        sourceProgramId: snapshot.sourceProgramId,
        sourceWorkoutTemplateId: snapshot.sourceWorkoutTemplateId,
        programNameSnapshot: snapshot.programNameSnapshot,
        workoutTemplateNameSnapshot: snapshot.workoutTemplateNameSnapshot,
        name: snapshot.name,
        status: 'ACTIVE',
        localDate,
        timezone: params.timezone,
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
  }

  async pause(
    userId: string,
    workoutSessionId: string,
    input: unknown,
  ): Promise<WorkoutLifecycleResult> {
    const data = pauseWorkoutSessionSchema.parse(input);
    return this.transitionLifecycle(userId, workoutSessionId, 'PAUSE', data, {});
  }

  async resume(
    userId: string,
    workoutSessionId: string,
    input: unknown,
  ): Promise<WorkoutLifecycleResult> {
    const data = resumeWorkoutSessionSchema.parse(input);
    return this.transitionLifecycle(userId, workoutSessionId, 'RESUME', data, {});
  }

  async complete(
    userId: string,
    workoutSessionId: string,
    input: unknown,
  ): Promise<WorkoutLifecycleResult> {
    const data = completeWorkoutSessionSchema.parse(input);
    const notes = normalizeOptionalPlainText(data.notes);
    return this.transitionLifecycle(
      userId,
      workoutSessionId,
      'COMPLETE',
      { ...data, notes },
      notes === undefined ? {} : { notes },
    );
  }

  async cancel(
    userId: string,
    workoutSessionId: string,
    input: unknown,
  ): Promise<WorkoutLifecycleResult> {
    const data = cancelWorkoutSessionSchema.parse(input);
    const reason = normalizeOptionalPlainText(data.reason) ?? null;
    return this.transitionLifecycle(
      userId,
      workoutSessionId,
      'CANCEL',
      { ...data, reason },
      { reason, keepRecordedData: true },
    );
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
      const result = await this.prisma.$transaction(async (tx) => {
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

        // Idempotence avant contrôle de version / statut (rejeu après perte de réponse).
        if (data.clientCommandId) {
          const existingReceipt = await tx.workoutSetCommand.findFirst({
            where: {
              ownerUserId: userId,
              clientCommandId: data.clientCommandId,
            },
          });

          if (existingReceipt) {
            if (
              existingReceipt.workoutSessionId !== session.id ||
              existingReceipt.workoutSetId !== workoutSetId
            ) {
              throw new ConflictException({
                code: 'WORKOUT_SET_COMMAND_CONFLICT',
                message:
                  'Cet identifiant de commande est déjà utilisé pour une autre série.',
              });
            }

            const exerciseForReceipt = await tx.workoutSessionExercise.findFirst({
              where: {
                id: sessionExerciseId,
                workoutSessionId: session.id,
              },
              select: { measurementTypeSnapshot: true },
            });
            if (!exerciseForReceipt) {
              throw new NotFoundException({
                code: 'WORKOUT_SET_NOT_FOUND',
                message: 'Série introuvable.',
              });
            }

            const receiptValidation = validateWorkoutSetActuals(
              exerciseForReceipt.measurementTypeSnapshot,
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
            if (!receiptValidation.ok) {
              throw new BadRequestException({
                code: receiptValidation.code,
                message: receiptValidation.message,
              });
            }

            const fingerprint = buildWorkoutSetCommandFingerprint(
              receiptValidation.normalized,
            );
            if (existingReceipt.payloadFingerprint !== fingerprint) {
              throw new ConflictException({
                code: 'WORKOUT_SET_COMMAND_CONFLICT',
                message:
                  'Cet identifiant de commande a déjà été utilisé avec un autre payload.',
              });
            }

            const existingSet = await tx.workoutSet.findFirst({
              where: { id: workoutSetId, ownerUserId: userId },
            });
            if (!existingSet) {
              throw new NotFoundException({
                code: 'WORKOUT_SET_NOT_FOUND',
                message: 'Série introuvable.',
              });
            }

            return {
              result: {
                workoutSet: toWorkoutSetDetail(
                  existingSet as WorkoutSetSnapshotRow,
                ),
                workoutSessionVersion: existingReceipt.appliedVersion,
              },
              previousStatus: existingSet.status,
              nextStatus: existingSet.status,
              replay: true as const,
            };
          }
        }

        if (session.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: 'WORKOUT_NOT_EDITABLE',
            message:
              session.status === 'PAUSED'
                ? 'La séance est en pause : les séries ne sont pas modifiables.'
                : 'Cette séance n’est plus modifiable.',
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

        const previousStatus = set.status;

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
        const fingerprint = buildWorkoutSetCommandFingerprint(normalized);

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

        if (data.clientCommandId) {
          await tx.workoutSetCommand.create({
            data: {
              ownerUserId: userId,
              workoutSessionId: session.id,
              workoutSetId: set.id,
              clientCommandId: data.clientCommandId,
              payloadFingerprint: fingerprint,
              appliedVersion: updatedSession.version,
            },
          });
        }

        return {
          result: {
            workoutSet: toWorkoutSetDetail(updatedSet as WorkoutSetSnapshotRow),
            workoutSessionVersion: updatedSession.version,
          },
          previousStatus,
          nextStatus: normalized.status,
          replay: false as const,
        };
      });

      if (!result.replay) {
        await this.sharedSessionLinkNotifier.notifyProgressIfProcessedChanged(
          workoutSessionId,
          result.previousStatus,
          result.nextStatus,
        );
      }

      return result.result;
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

  private async transitionLifecycle(
    userId: string,
    workoutSessionId: string,
    action: WorkoutLifecycleAction,
    data: {
      expectedVersion: number;
      clientCommandId?: string;
      notes?: string | null;
      reason?: string | null;
    },
    fingerprintPayload: Record<string, unknown>,
  ): Promise<WorkoutLifecycleResult> {
    const fingerprint = buildWorkoutLifecycleFingerprint(
      action,
      fingerprintPayload,
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const session = await tx.workoutSession.findFirst({
          where: { id: workoutSessionId, ownerUserId: userId },
        });

        if (!session) {
          throw new NotFoundException({
            code: 'WORKOUT_NOT_FOUND',
            message: 'Séance introuvable.',
          });
        }

        // Idempotence avant contrôle de version (rejeu après perte de réponse).
        if (data.clientCommandId) {
          const existing = await tx.workoutLifecycleCommand.findFirst({
            where: {
              ownerUserId: userId,
              clientCommandId: data.clientCommandId,
            },
          });
          if (existing) {
            if (
              existing.workoutSessionId !== session.id ||
              existing.action !== action ||
              existing.payloadFingerprint !== fingerprint
            ) {
              throw new ConflictException({
                code: 'WORKOUT_COMMAND_CONFLICT',
                message:
                  'Cet identifiant de commande a déjà été utilisé avec un autre payload.',
              });
            }
            const detail = await tx.workoutSession.findFirstOrThrow({
              where: { id: session.id },
              include: sessionDetailInclude,
            });
            const mapped = toWorkoutSessionDetail(
              detail as WorkoutSessionSnapshotRow,
            );
            return {
              workoutSession: mapped,
              workoutSessionVersion: mapped.version,
              statusChanged: false as const,
            };
          }
        }

        if (session.version !== data.expectedVersion) {
          throw new ConflictException({
            code: 'WORKOUT_VERSION_CONFLICT',
            message:
              'La séance a été modifiée depuis un autre onglet ou appareil.',
            details: { currentVersion: session.version },
          });
        }

        const transition = resolveWorkoutLifecycleTransition(
          session.status,
          action,
        );
        if (!transition.ok) {
          throw new ConflictException({
            code: transition.code,
            message: transition.message,
          });
        }

        if (transition.kind === 'noop') {
          if (data.clientCommandId) {
            await tx.workoutLifecycleCommand.create({
              data: {
                ownerUserId: userId,
                workoutSessionId: session.id,
                clientCommandId: data.clientCommandId,
                action,
                payloadFingerprint: fingerprint,
              },
            });
          }
          const detail = await tx.workoutSession.findFirstOrThrow({
            where: { id: session.id },
            include: sessionDetailInclude,
          });
          const mapped = toWorkoutSessionDetail(
            detail as WorkoutSessionSnapshotRow,
          );
          return {
            workoutSession: mapped,
            workoutSessionVersion: mapped.version,
            statusChanged: false as const,
          };
        }

        const now = new Date();
        const updateData: Prisma.WorkoutSessionUpdateInput = {
          status: transition.nextStatus,
          version: { increment: 1 },
        };

        if (action === 'PAUSE') {
          updateData.pausedAt = now;
          updateData.completedAt = null;
          updateData.cancelledAt = null;
          updateData.cancellationReason = null;
        } else if (action === 'RESUME') {
          updateData.pausedAt = null;
        } else if (action === 'COMPLETE') {
          updateData.completedAt = now;
          updateData.pausedAt = null;
          updateData.cancelledAt = null;
          updateData.cancellationReason = null;
          if (data.notes !== undefined) {
            updateData.notes = data.notes;
          }
        } else if (action === 'CANCEL') {
          updateData.cancelledAt = now;
          updateData.pausedAt = null;
          updateData.completedAt = null;
          updateData.cancellationReason = data.reason ?? null;
        }

        await tx.workoutSession.update({
          where: { id: session.id },
          data: updateData,
        });

        if (data.clientCommandId) {
          await tx.workoutLifecycleCommand.create({
            data: {
              ownerUserId: userId,
              workoutSessionId: session.id,
              clientCommandId: data.clientCommandId,
              action,
              payloadFingerprint: fingerprint,
            },
          });
        }

        const detail = await tx.workoutSession.findFirstOrThrow({
          where: { id: session.id },
          include: sessionDetailInclude,
        });
        const mapped = toWorkoutSessionDetail(
          detail as WorkoutSessionSnapshotRow,
        );
        return {
          workoutSession: mapped,
          workoutSessionVersion: mapped.version,
          statusChanged: true as const,
        };
      });

      if (result.statusChanged) {
        if (action === 'COMPLETE' || action === 'CANCEL') {
          await this.sharedSessionLinkNotifier.clearCurrentExerciseAfterTerminal(
            workoutSessionId,
          );
        }
        await this.sharedSessionLinkNotifier.notifyIfLinked(workoutSessionId);
      }

      return {
        workoutSession: result.workoutSession,
        workoutSessionVersion: result.workoutSessionVersion,
      };
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
          code: 'WORKOUT_DUPLICATE_COMMAND',
          message: 'Identifiant de commande déjà utilisé.',
        });
      }
      throw error;
    }
  }

  /**
   * Remplace l’exercice catalogue d’une ligne de séance ACTIVE.
   * Conserve les séries (targets) ; interdit si une série n’est plus PENDING.
   * Ne modifie jamais Program / WorkoutTemplate.
   */
  async replaceExercise(
    userId: string,
    workoutSessionId: string,
    sessionExerciseId: string,
    input: unknown,
  ): Promise<WorkoutSessionDetail> {
    const data = replaceWorkoutSessionExerciseSchema.parse(input);

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

        if (session.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: 'WORKOUT_NOT_EDITABLE',
            message:
              session.status === 'PAUSED'
                ? 'La séance est en pause : remplacez l’exercice après reprise.'
                : 'Cette séance n’est plus modifiable.',
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

        const sessionExercise = await tx.workoutSessionExercise.findFirst({
          where: {
            id: sessionExerciseId,
            workoutSessionId: session.id,
          },
          include: {
            sets: {
              select: { id: true, status: true },
            },
          },
        });

        if (!sessionExercise) {
          throw new NotFoundException({
            code: 'WORKOUT_SESSION_EXERCISE_NOT_FOUND',
            message: 'Exercice de séance introuvable.',
          });
        }

        // Idempotent : même exercice catalogue → pas de mutation.
        if (sessionExercise.sourceExerciseId === data.exerciseId) {
          const unchanged = await tx.workoutSession.findFirstOrThrow({
            where: { id: session.id },
            include: sessionDetailInclude,
          });
          return toWorkoutSessionDetail(
            unchanged as WorkoutSessionSnapshotRow,
          );
        }

        const hasRecordedSet = sessionExercise.sets.some(
          (set) => set.status !== 'PENDING',
        );
        if (hasRecordedSet) {
          throw new BadRequestException({
            code: 'WORKOUT_EXERCISE_HAS_RECORDED_SETS',
            message:
              'Cet exercice a déjà des séries enregistrées. Supprime ou réinitialise ses séries avant de le remplacer.',
          });
        }

        const newExercise = await tx.exercise.findFirst({
          where: {
            id: data.exerciseId,
            OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
          },
          include: {
            primaryMuscleGroup: { select: { name: true } },
            defaultEquipmentType: {
              select: { id: true, name: true, code: true },
            },
          },
        });

        if (!newExercise) {
          throw new NotFoundException({
            code: 'EXERCISE_NOT_FOUND',
            message: 'Exercice introuvable.',
          });
        }

        if (newExercise.archivedAt) {
          throw new BadRequestException({
            code: 'EXERCISE_ARCHIVED',
            message: 'Cet exercice est archivé et ne peut pas être utilisé.',
          });
        }

        if (
          newExercise.measurementType !==
          sessionExercise.measurementTypeSnapshot
        ) {
          throw new BadRequestException({
            code: 'WORKOUT_EXERCISE_MEASUREMENT_INCOMPATIBLE',
            message:
              'L’exercice de remplacement doit avoir le même type de mesure.',
          });
        }

        await tx.workoutSessionExercise.update({
          where: { id: sessionExercise.id },
          data: {
            sourceExerciseId: newExercise.id,
            exerciseNameSnapshot: newExercise.name,
            measurementTypeSnapshot: newExercise.measurementType,
            primaryMuscleGroupNameSnapshot: newExercise.primaryMuscleGroup.name,
            sourceExerciseArchivedAtCreation: false,
            equipmentTypeId: newExercise.defaultEquipmentType?.id ?? null,
            equipmentNameSnapshot:
              newExercise.defaultEquipmentType?.name ?? null,
            equipmentCodeSnapshot:
              newExercise.defaultEquipmentType?.code ?? null,
            // Conserve notes / repos de la ligne de séance et
            // sourceTemplateExerciseId (provenance template, non contaminante).
          },
        });

        const updatedSession = await tx.workoutSession.update({
          where: { id: session.id },
          data: { version: { increment: 1 } },
          include: sessionDetailInclude,
        });

        return toWorkoutSessionDetail(
          updatedSession as WorkoutSessionSnapshotRow,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          code: 'WORKOUT_NOT_FOUND',
          message: 'Séance introuvable.',
        });
      }
      throw error;
    }
  }

  private async loadStartableTemplateOrThrow(
    userId: string,
    sourceWorkoutTemplateId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TemplateForSnapshot> {
    const template = await db.workoutTemplate.findFirst({
      where: {
        id: sourceWorkoutTemplateId,
        ownerUserId: userId,
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
            ownerUserId: true,
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
                primaryMuscleGroup: { select: { name: true } },
              },
            },
            equipmentType: {
              select: { id: true, name: true, code: true },
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
        message: 'Impossible de démarrer une séance depuis un programme archivé.',
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
