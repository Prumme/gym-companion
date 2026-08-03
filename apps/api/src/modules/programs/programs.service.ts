import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActiveProgramSummary,
  ProgramDetail,
  ProgramListResponse,
  ProgramSchedule,
} from '@gym-companion/shared';
import type { Prisma } from '@prisma/client';
import {
  activateProgramSchema,
  addWorkoutTemplateExerciseSchema,
  buildProgramCursorFilter,
  compactOrderedPositions,
  compactWorkoutTemplatePositions,
  computeNextOrderedPosition,
  computeNextWorkoutTemplatePosition,
  createProgramSchema,
  createWorkoutTemplateSchema,
  createWorkoutTemplateSetSchema,
  decodeProgramCursor,
  encodeProgramCursor,
  listProgramsQuerySchema,
  localDateStringToUtcDate,
  replaceProgramScheduleSchema,
  reorderWorkoutTemplateExercisesSchema,
  reorderWorkoutTemplatesSchema,
  reorderWorkoutTemplateSetsSchema,
  todayLocalDateString,
  updateProgramSchema,
  updateWorkoutTemplateExerciseSchema,
  updateWorkoutTemplateSchema,
  updateWorkoutTemplateSetSchema,
  utcDateToLocalDateString,
  validateProgramScheduleEntries,
  validateWorkoutTemplateExerciseReorder,
  validateWorkoutTemplateReorder,
  validateWorkoutTemplateSetReorder,
  validateWorkoutTemplateSetTargets,
  type WorkoutTemplateSetTargetFields,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toActiveProgramSummary,
  toProgramDetail,
  toProgramListItem,
  toProgramSchedule,
  type ProgramRow,
  type ScheduleEntryRow,
} from './programs.mapper';

const exerciseCatalogInclude = {
  primaryMuscleGroup: true,
  defaultEquipmentType: true,
} satisfies Prisma.ExerciseInclude;

const templateExerciseInclude = {
  exercise: { include: exerciseCatalogInclude },
  equipmentType: true,
  sets: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.WorkoutTemplateExerciseInclude;

const programDetailInclude = {
  workoutTemplates: {
    orderBy: { positionInProgram: 'asc' as const },
    include: {
      _count: { select: { exercises: true } },
      exercises: {
        orderBy: { position: 'asc' as const },
        include: templateExerciseInclude,
      },
    },
  },
  _count: { select: { workoutTemplates: true } },
} satisfies Prisma.ProgramInclude;

const scheduleEntryInclude = {
  workoutTemplate: {
    include: {
      _count: { select: { exercises: true } },
    },
  },
} satisfies Prisma.ProgramScheduleEntryInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    rawQuery: Record<string, string | undefined>,
  ): Promise<ProgramListResponse> {
    let query: ReturnType<typeof listProgramsQuerySchema.parse>;
    try {
      query = listProgramsQuerySchema.parse(rawQuery);
    } catch {
      throw new BadRequestException({
        code: 'PROGRAM_INVALID_LIST_QUERY',
        message: 'Paramètres de liste invalides.',
      });
    }

    let cursorFilter: ReturnType<typeof buildProgramCursorFilter> | undefined;
    if (query.cursor) {
      try {
        cursorFilter = buildProgramCursorFilter(decodeProgramCursor(query.cursor));
      } catch {
        throw new BadRequestException({
          code: 'PROGRAM_INVALID_CURSOR',
          message: 'Cursor de pagination invalide.',
        });
      }
    }

    const filters: Prisma.ProgramWhereInput[] = [{ ownerUserId: userId }];
    if (!query.includeArchived) {
      filters.push({ archivedAt: null });
    }
    if (cursorFilter) {
      filters.push(cursorFilter);
    }

    const rows = await this.prisma.program.findMany({
      where: { AND: filters },
      include: { _count: { select: { workoutTemplates: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeProgramCursor({
            version: 1,
            updatedAt: last.updatedAt.toISOString(),
            id: last.id,
          })
        : null;

    const current = await this.findCurrentActivation(userId);
    const currentProgramId = current?.programId ?? null;

    return {
      data: pageRows.map((row) =>
        toProgramListItem(row as ProgramRow, row.id === currentProgramId),
      ),
      pagination: { nextCursor, hasMore },
    };
  }

  async getById(userId: string, programId: string): Promise<ProgramDetail> {
    const row = await this.findOwnedOrThrow(userId, programId);
    const isCurrent = await this.isCurrentProgram(userId, programId);
    return toProgramDetail(row, isCurrent);
  }

  async getActive(userId: string): Promise<ActiveProgramSummary | null> {
    const activation = await this.findCurrentActivation(userId);
    if (!activation) {
      return null;
    }
    const program = await this.prisma.program.findUnique({
      where: { id: activation.programId },
      include: { _count: { select: { workoutTemplates: true } } },
    });
    if (!program || program.ownerUserId !== userId) {
      return null;
    }
    const scheduleRows = await this.loadScheduleRows(activation.programId);
    return toActiveProgramSummary({
      activationId: activation.id,
      startedOn: activation.startedOn,
      program: program as ProgramRow,
      scheduleRows,
    });
  }

  async create(userId: string, input: unknown): Promise<ProgramDetail> {
    const data = createProgramSchema.parse(input);
    const created = await this.prisma.program.create({
      data: {
        ownerUserId: userId,
        name: data.name.trim(),
        description: data.description ?? null,
        goal: data.goal,
        status: 'DRAFT',
      },
      include: programDetailInclude,
    });
    return toProgramDetail(created as ProgramRow, false);
  }

  async update(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateProgramSchema.parse(input);
    const existing = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(existing);

    const updated = await this.prisma.program.update({
      where: { id: programId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.goal !== undefined ? { goal: data.goal } : {}),
      },
      include: programDetailInclude,
    });
    const isCurrent = await this.isCurrentProgram(userId, programId);
    return toProgramDetail(updated as ProgramRow, isCurrent);
  }

  async archive(userId: string, programId: string): Promise<ProgramDetail> {
    const existing = await this.findOwnedOrThrow(userId, programId);
    if (existing.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_ALREADY_ARCHIVED',
        message: 'Ce programme est déjà archivé.',
      });
    }

    if (await this.isCurrentProgram(userId, programId)) {
      throw new ConflictException({
        code: 'PROGRAM_MUST_BE_INACTIVE_BEFORE_ARCHIVE',
        message:
          'Désactive ce programme avant de l’archiver. Un programme courant ne peut pas être archivé.',
      });
    }

    const archived = await this.prisma.program.update({
      where: { id: programId },
      data: {
        archivedAt: new Date(),
        status: 'ARCHIVED',
      },
      include: programDetailInclude,
    });
    return toProgramDetail(archived as ProgramRow, false);
  }

  async restore(userId: string, programId: string): Promise<ProgramDetail> {
    const existing = await this.findOwnedOrThrow(userId, programId);
    if (!existing.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_NOT_ARCHIVED',
        message: 'Ce programme n’est pas archivé.',
      });
    }

    const restored = await this.prisma.program.update({
      where: { id: programId },
      data: {
        archivedAt: null,
        status: 'DRAFT',
        activatedAt: null,
      },
      include: programDetailInclude,
    });
    return toProgramDetail(restored as ProgramRow, false);
  }

  async activate(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ActiveProgramSummary> {
    const data = activateProgramSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    if (program.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_ARCHIVED',
        message: 'Un programme archivé ne peut pas être activé.',
      });
    }

    const startedOn = localDateStringToUtcDate(data.startedOn);
    const timezone = await this.getUserTimezone(userId);
    const endedOnToday = localDateStringToUtcDate(todayLocalDateString(timezone));

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.programActivation.findFirst({
          where: { userId, endedOn: null },
        });

        if (current?.programId === programId) {
          if (utcDateToLocalDateString(current.startedOn) !== data.startedOn) {
            await tx.programActivation.update({
              where: { id: current.id },
              data: { startedOn },
            });
          }
          return;
        }

        if (current && !data.replaceCurrentProgram) {
          throw new ConflictException({
            code: 'PROGRAM_ACTIVE_CONFLICT',
            message:
              'Un autre programme est déjà courant. Confirme le remplacement pour continuer.',
          });
        }

        if (current && data.replaceCurrentProgram) {
          await tx.programActivation.update({
            where: { id: current.id },
            data: { endedOn: endedOnToday },
          });
          await tx.program.update({
            where: { id: current.programId },
            data: { status: 'DRAFT', activatedAt: null },
          });
        }

        await tx.programActivation.create({
          data: {
            userId,
            programId,
            startedOn,
            endedOn: null,
          },
        });
        await tx.program.update({
          where: { id: programId },
          data: {
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
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
          code: 'PROGRAM_ACTIVE_CONFLICT',
          message: 'Un autre programme est déjà courant.',
        });
      }
      throw error;
    }

    const active = await this.getActive(userId);
    if (!active) {
      throw new ConflictException({
        code: 'PROGRAM_ACTIVE_CONFLICT',
        message: 'Impossible d’activer ce programme.',
      });
    }
    return active;
  }

  async deactivate(
    userId: string,
    programId: string,
  ): Promise<ActiveProgramSummary | null> {
    await this.findOwnedOrThrow(userId, programId);
    const timezone = await this.getUserTimezone(userId);
    const endedOnToday = localDateStringToUtcDate(todayLocalDateString(timezone));

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.programActivation.findFirst({
        where: { userId, endedOn: null, programId },
      });
      if (!current) {
        return;
      }
      await tx.programActivation.update({
        where: { id: current.id },
        data: { endedOn: endedOnToday },
      });
      await tx.program.update({
        where: { id: programId },
        data: { status: 'DRAFT', activatedAt: null },
      });
    });

    return this.getActive(userId);
  }

  async getSchedule(
    userId: string,
    programId: string,
  ): Promise<ProgramSchedule> {
    await this.findOwnedOrThrow(userId, programId);
    const rows = await this.loadScheduleRows(programId);
    return toProgramSchedule(rows);
  }

  async replaceSchedule(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramSchedule> {
    const data = replaceProgramScheduleSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);

    const positionsCheck = validateProgramScheduleEntries(data.entries);
    if (!positionsCheck.ok) {
      throw new BadRequestException({
        code: positionsCheck.code,
        message: positionsCheck.message,
      });
    }

    const templateIds = [
      ...new Set(data.entries.map((entry) => entry.workoutTemplateId)),
    ];
    if (templateIds.length > 0) {
      const templates = await this.prisma.workoutTemplate.findMany({
        where: { programId, id: { in: templateIds } },
        select: { id: true },
      });
      if (templates.length !== templateIds.length) {
        throw new BadRequestException({
          code: 'PROGRAM_SCHEDULE_TEMPLATE_MISMATCH',
          message:
            'Un ou plusieurs modèles n’appartiennent pas à ce programme.',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.programScheduleEntry.deleteMany({ where: { programId } });
      if (data.entries.length === 0) {
        return;
      }
      await tx.programScheduleEntry.createMany({
        data: data.entries.map((entry) => ({
          programId,
          workoutTemplateId: entry.workoutTemplateId,
          weekday: entry.weekday,
          position: entry.position,
        })),
      });
    });

    return this.getSchedule(userId, programId);
  }

  async createWorkoutTemplate(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = createWorkoutTemplateSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { positionInProgram: true },
        orderBy: { positionInProgram: 'asc' },
      });
      const position = computeNextWorkoutTemplatePosition(
        existing.map((item) => item.positionInProgram),
      );

      await tx.workoutTemplate.create({
        data: {
          ownerUserId: userId,
          programId,
          name: data.name.trim(),
          description: data.description ?? null,
          estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
          positionInProgram: position,
        },
      });
    });

    return this.getById(userId, programId);
  }

  async updateWorkoutTemplate(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateWorkoutTemplateSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    await this.prisma.workoutTemplate.update({
      where: { id: workoutTemplateId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.estimatedDurationMinutes !== undefined
          ? { estimatedDurationMinutes: data.estimatedDurationMinutes }
          : {}),
      },
    });

    return this.getById(userId, programId);
  }

  async deleteWorkoutTemplate(
    userId: string,
    programId: string,
    workoutTemplateId: string,
  ): Promise<ProgramDetail> {
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplate.delete({ where: { id: workoutTemplateId } });

      const remaining = await tx.workoutTemplate.findMany({
        where: { programId },
        orderBy: { positionInProgram: 'asc' },
        select: { id: true },
      });
      await this.reassignTemplatePositions(
        tx,
        compactWorkoutTemplatePositions(remaining.map((item) => item.id)),
      );
      await this.compactSchedulePositions(tx, programId);
    });

    return this.getById(userId, programId);
  }

  async reorderWorkoutTemplates(
    userId: string,
    programId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = reorderWorkoutTemplatesSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplate.findMany({
        where: { programId },
        select: { id: true },
        orderBy: { positionInProgram: 'asc' },
      });
      const validation = validateWorkoutTemplateReorder(
        data.workoutTemplateIds,
        existing.map((item) => item.id),
      );
      if (!validation.ok) {
        throw new BadRequestException({
          code: validation.code,
          message: this.reorderMessage(validation.code),
        });
      }

      await this.reassignTemplatePositions(
        tx,
        compactWorkoutTemplatePositions(data.workoutTemplateIds),
      );
    });

    return this.getById(userId, programId);
  }

  async addExercise(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = addWorkoutTemplateExerciseSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    const exercise = await this.findAccessibleExerciseOrThrow(
      userId,
      data.exerciseId,
    );
    if (exercise.archivedAt) {
      throw new BadRequestException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_NOT_EDITABLE',
        message: 'Un exercice archivé ne peut pas être ajouté à un modèle.',
      });
    }

    await this.assertCompatibleEquipment(
      data.exerciseId,
      data.equipmentTypeId,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.workoutTemplateExercise.findMany({
          where: { workoutTemplateId },
          select: { position: true },
        });
        const position = computeNextOrderedPosition(
          existing.map((item) => item.position),
        );
        await tx.workoutTemplateExercise.create({
          data: {
            workoutTemplateId,
            exerciseId: data.exerciseId,
            position,
            equipmentTypeId: data.equipmentTypeId,
            restSecondsOverride: data.restSecondsOverride,
            notes: data.notes ?? null,
          },
        });
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'WORKOUT_TEMPLATE_EXERCISE_ALREADY_EXISTS',
          message: 'Cet exercice est déjà présent dans ce modèle.',
        });
      }
      throw error;
    }

    return this.getById(userId, programId);
  }

  async updateExercise(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateWorkoutTemplateExerciseSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    const templateExercise = await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );

    if (data.equipmentTypeId !== undefined) {
      await this.assertCompatibleEquipment(
        templateExercise.exerciseId,
        data.equipmentTypeId,
      );
    }

    await this.prisma.workoutTemplateExercise.update({
      where: { id: templateExerciseId },
      data: {
        ...(data.equipmentTypeId !== undefined
          ? { equipmentTypeId: data.equipmentTypeId }
          : {}),
        ...(data.restSecondsOverride !== undefined
          ? { restSecondsOverride: data.restSecondsOverride }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    return this.getById(userId, programId);
  }

  async removeExercise(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
  ): Promise<ProgramDetail> {
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplateExercise.delete({
        where: { id: templateExerciseId },
      });
      const remaining = await tx.workoutTemplateExercise.findMany({
        where: { workoutTemplateId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      await this.reassignExercisePositions(
        tx,
        compactOrderedPositions(remaining.map((item) => item.id)),
      );
    });

    return this.getById(userId, programId);
  }

  async reorderExercises(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = reorderWorkoutTemplateExercisesSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplateExercise.findMany({
        where: { workoutTemplateId },
        select: { id: true },
        orderBy: { position: 'asc' },
      });
      const validation = validateWorkoutTemplateExerciseReorder(
        data.workoutTemplateExerciseIds,
        existing.map((item) => item.id),
      );
      if (!validation.ok) {
        throw new BadRequestException({
          code: validation.code,
          message: this.reorderMessage(validation.code),
        });
      }
      await this.reassignExercisePositions(
        tx,
        compactOrderedPositions(data.workoutTemplateExerciseIds),
      );
    });

    return this.getById(userId, programId);
  }

  async createSet(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = createWorkoutTemplateSetSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    const templateExercise = await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );

    this.assertSetTargets(
      templateExercise.exercise.measurementType,
      data,
    );

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplateSet.findMany({
        where: { workoutTemplateExerciseId: templateExerciseId },
        select: { position: true },
      });
      const position = computeNextOrderedPosition(
        existing.map((item) => item.position),
      );
      await tx.workoutTemplateSet.create({
        data: {
          workoutTemplateExerciseId: templateExerciseId,
          position,
          setType: data.setType,
          targetRepMin: data.targetRepMin,
          targetRepMax: data.targetRepMax,
          targetDurationSeconds: data.targetDurationSeconds,
          targetDistanceMeters: data.targetDistanceMeters,
          targetWeightKg: data.targetWeightKg,
          targetIntensityPercent: data.targetIntensityPercent,
          targetRir: data.targetRir,
          targetRpe: data.targetRpe,
          restSeconds: data.restSeconds,
        },
      });
    });

    return this.getById(userId, programId);
  }

  async updateSet(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
    setId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = updateWorkoutTemplateSetSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    const templateExercise = await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );
    const existingSet = await this.findSetOrThrow(templateExerciseId, setId);

    const merged: WorkoutTemplateSetTargetFields & { setType: string } = {
      setType: data.setType ?? existingSet.setType,
      targetRepMin:
        data.targetRepMin !== undefined
          ? data.targetRepMin
          : existingSet.targetRepMin,
      targetRepMax:
        data.targetRepMax !== undefined
          ? data.targetRepMax
          : existingSet.targetRepMax,
      targetDurationSeconds:
        data.targetDurationSeconds !== undefined
          ? data.targetDurationSeconds
          : existingSet.targetDurationSeconds,
      targetDistanceMeters:
        data.targetDistanceMeters !== undefined
          ? data.targetDistanceMeters
          : existingSet.targetDistanceMeters == null
            ? null
            : Number(existingSet.targetDistanceMeters),
      targetWeightKg:
        data.targetWeightKg !== undefined
          ? data.targetWeightKg
          : existingSet.targetWeightKg == null
            ? null
            : Number(existingSet.targetWeightKg),
      targetIntensityPercent:
        data.targetIntensityPercent !== undefined
          ? data.targetIntensityPercent
          : existingSet.targetIntensityPercent == null
            ? null
            : Number(existingSet.targetIntensityPercent),
      targetRir:
        data.targetRir !== undefined ? data.targetRir : existingSet.targetRir,
      targetRpe:
        data.targetRpe !== undefined
          ? data.targetRpe
          : existingSet.targetRpe == null
            ? null
            : Number(existingSet.targetRpe),
      restSeconds:
        data.restSeconds !== undefined
          ? data.restSeconds
          : existingSet.restSeconds,
    };

    this.assertSetTargets(templateExercise.exercise.measurementType, merged);

    await this.prisma.workoutTemplateSet.update({
      where: { id: setId },
      data: {
        ...(data.setType !== undefined ? { setType: data.setType } : {}),
        ...(data.targetRepMin !== undefined
          ? { targetRepMin: data.targetRepMin }
          : {}),
        ...(data.targetRepMax !== undefined
          ? { targetRepMax: data.targetRepMax }
          : {}),
        ...(data.targetDurationSeconds !== undefined
          ? { targetDurationSeconds: data.targetDurationSeconds }
          : {}),
        ...(data.targetDistanceMeters !== undefined
          ? { targetDistanceMeters: data.targetDistanceMeters }
          : {}),
        ...(data.targetWeightKg !== undefined
          ? { targetWeightKg: data.targetWeightKg }
          : {}),
        ...(data.targetIntensityPercent !== undefined
          ? { targetIntensityPercent: data.targetIntensityPercent }
          : {}),
        ...(data.targetRir !== undefined ? { targetRir: data.targetRir } : {}),
        ...(data.targetRpe !== undefined ? { targetRpe: data.targetRpe } : {}),
        ...(data.restSeconds !== undefined
          ? { restSeconds: data.restSeconds }
          : {}),
      },
    });

    return this.getById(userId, programId);
  }

  async deleteSet(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
    setId: string,
  ): Promise<ProgramDetail> {
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );
    await this.findSetOrThrow(templateExerciseId, setId);

    await this.prisma.$transaction(async (tx) => {
      await tx.workoutTemplateSet.delete({ where: { id: setId } });
      const remaining = await tx.workoutTemplateSet.findMany({
        where: { workoutTemplateExerciseId: templateExerciseId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      await this.reassignSetPositions(
        tx,
        compactOrderedPositions(remaining.map((item) => item.id)),
      );
    });

    return this.getById(userId, programId);
  }

  async reorderSets(
    userId: string,
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
    input: unknown,
  ): Promise<ProgramDetail> {
    const data = reorderWorkoutTemplateSetsSchema.parse(input);
    const program = await this.findOwnedOrThrow(userId, programId);
    this.assertEditable(program);
    await this.findTemplateExerciseOrThrow(
      programId,
      workoutTemplateId,
      templateExerciseId,
    );

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workoutTemplateSet.findMany({
        where: { workoutTemplateExerciseId: templateExerciseId },
        select: { id: true },
        orderBy: { position: 'asc' },
      });
      const validation = validateWorkoutTemplateSetReorder(
        data.setIds,
        existing.map((item) => item.id),
      );
      if (!validation.ok) {
        throw new BadRequestException({
          code: validation.code,
          message: this.reorderMessage(validation.code),
        });
      }
      await this.reassignSetPositions(
        tx,
        compactOrderedPositions(data.setIds),
      );
    });

    return this.getById(userId, programId);
  }

  private assertSetTargets(
    measurementType: Parameters<typeof validateWorkoutTemplateSetTargets>[0],
    targets: WorkoutTemplateSetTargetFields,
  ) {
    const validation = validateWorkoutTemplateSetTargets(
      measurementType,
      targets,
    );
    if (!validation.ok) {
      throw new BadRequestException({
        code: validation.code,
        message: validation.message,
      });
    }
  }

  private async findAccessibleExerciseOrThrow(userId: string, exerciseId: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      },
      include: {
        compatibleEquipment: true,
      },
    });
    if (!exercise) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }
    return exercise;
  }

  private async assertCompatibleEquipment(
    exerciseId: string,
    equipmentTypeId: string | null,
  ) {
    if (equipmentTypeId == null) {
      return;
    }
    const equipment = await this.prisma.equipmentType.findFirst({
      where: { id: equipmentTypeId, isActive: true },
    });
    if (!equipment) {
      throw new BadRequestException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_INVALID_EQUIPMENT',
        message: 'Type d’équipement invalide ou inactif.',
      });
    }
    const compatible = await this.prisma.exerciseEquipmentCompatibility.findFirst({
      where: { exerciseId, equipmentTypeId },
    });
    if (!compatible) {
      throw new BadRequestException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_INVALID_EQUIPMENT',
        message: 'Cet équipement n’est pas compatible avec l’exercice.',
      });
    }
  }

  private async findCurrentActivation(userId: string) {
    return this.prisma.programActivation.findFirst({
      where: { userId, endedOn: null },
    });
  }

  private async isCurrentProgram(
    userId: string,
    programId: string,
  ): Promise<boolean> {
    const current = await this.prisma.programActivation.findFirst({
      where: { userId, programId, endedOn: null },
      select: { id: true },
    });
    return current != null;
  }

  private async getUserTimezone(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone || 'Europe/Paris';
  }

  private async loadScheduleRows(
    programId: string,
  ): Promise<ScheduleEntryRow[]> {
    const rows = await this.prisma.programScheduleEntry.findMany({
      where: { programId },
      include: scheduleEntryInclude,
      orderBy: [{ weekday: 'asc' }, { position: 'asc' }],
    });
    return rows as ScheduleEntryRow[];
  }

  private async compactSchedulePositions(tx: Tx, programId: string) {
    const weekdays = await tx.programScheduleEntry.findMany({
      where: { programId },
      distinct: ['weekday'],
      select: { weekday: true },
    });

    for (const { weekday } of weekdays) {
      const entries = await tx.programScheduleEntry.findMany({
        where: { programId, weekday },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [index, entry] of entries.entries()) {
        await tx.programScheduleEntry.update({
          where: { id: entry.id },
          data: { position: -(index + 1) },
        });
      }
      for (const [index, entry] of entries.entries()) {
        await tx.programScheduleEntry.update({
          where: { id: entry.id },
          data: { position: index },
        });
      }
    }
  }

  private async findOwnedOrThrow(
    userId: string,
    programId: string,
  ): Promise<ProgramRow> {
    const row = await this.prisma.program.findUnique({
      where: { id: programId },
      include: programDetailInclude,
    });
    if (!row || row.ownerUserId !== userId) {
      throw new NotFoundException({
        code: 'PROGRAM_NOT_FOUND',
        message: 'Programme introuvable.',
      });
    }
    return row as ProgramRow;
  }

  private assertEditable(program: ProgramRow) {
    if (program.archivedAt) {
      throw new ForbiddenException({
        code: 'PROGRAM_NOT_EDITABLE',
        message: 'Un programme archivé ne peut pas être modifié.',
      });
    }
  }

  private async findTemplateInProgramOrThrow(
    programId: string,
    workoutTemplateId: string,
  ) {
    const template = await this.prisma.workoutTemplate.findFirst({
      where: { id: workoutTemplateId, programId },
    });
    if (!template) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_NOT_FOUND',
        message: 'Modèle de séance introuvable.',
      });
    }
    return template;
  }

  private async findTemplateExerciseOrThrow(
    programId: string,
    workoutTemplateId: string,
    templateExerciseId: string,
  ) {
    await this.findTemplateInProgramOrThrow(programId, workoutTemplateId);
    const row = await this.prisma.workoutTemplateExercise.findFirst({
      where: { id: templateExerciseId, workoutTemplateId },
      include: { exercise: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND',
        message: 'Exercice du modèle introuvable.',
      });
    }
    return row;
  }

  private async findSetOrThrow(templateExerciseId: string, setId: string) {
    const set = await this.prisma.workoutTemplateSet.findFirst({
      where: { id: setId, workoutTemplateExerciseId: templateExerciseId },
    });
    if (!set) {
      throw new NotFoundException({
        code: 'WORKOUT_TEMPLATE_SET_NOT_FOUND',
        message: 'Série cible introuvable.',
      });
    }
    return set;
  }

  private async reassignTemplatePositions(
    tx: Tx,
    compacted: Array<{ id: string; position: number }>,
  ) {
    for (const [index, item] of compacted.entries()) {
      await tx.workoutTemplate.update({
        where: { id: item.id },
        data: { positionInProgram: -(index + 1) },
      });
    }
    for (const item of compacted) {
      await tx.workoutTemplate.update({
        where: { id: item.id },
        data: { positionInProgram: item.position },
      });
    }
  }

  private async reassignExercisePositions(
    tx: Tx,
    compacted: Array<{ id: string; position: number }>,
  ) {
    for (const [index, item] of compacted.entries()) {
      await tx.workoutTemplateExercise.update({
        where: { id: item.id },
        data: { position: -(index + 1) },
      });
    }
    for (const item of compacted) {
      await tx.workoutTemplateExercise.update({
        where: { id: item.id },
        data: { position: item.position },
      });
    }
  }

  private async reassignSetPositions(
    tx: Tx,
    compacted: Array<{ id: string; position: number }>,
  ) {
    for (const [index, item] of compacted.entries()) {
      await tx.workoutTemplateSet.update({
        where: { id: item.id },
        data: { position: -(index + 1) },
      });
    }
    for (const item of compacted) {
      await tx.workoutTemplateSet.update({
        where: { id: item.id },
        data: { position: item.position },
      });
    }
  }

  private reorderMessage(code: string): string {
    const messages: Record<string, string> = {
      WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER:
        'La liste d’ordre contient des doublons.',
      WORKOUT_TEMPLATE_ORDER_INCOMPLETE:
        'La liste d’ordre doit contenir tous les modèles du programme.',
      WORKOUT_TEMPLATE_INVALID_ORDER:
        'La liste d’ordre contient un modèle inconnu ou étranger.',
      WORKOUT_TEMPLATE_EXERCISE_DUPLICATE_IN_ORDER:
        'La liste d’ordre contient des doublons.',
      WORKOUT_TEMPLATE_EXERCISE_ORDER_INCOMPLETE:
        'La liste d’ordre doit contenir tous les exercices du modèle.',
      WORKOUT_TEMPLATE_EXERCISE_INVALID_ORDER:
        'La liste d’ordre contient un exercice inconnu ou étranger.',
      WORKOUT_TEMPLATE_SET_DUPLICATE_IN_ORDER:
        'La liste d’ordre contient des doublons.',
      WORKOUT_TEMPLATE_SET_ORDER_INCOMPLETE:
        'La liste d’ordre doit contenir toutes les séries.',
      WORKOUT_TEMPLATE_SET_INVALID_ORDER:
        'La liste d’ordre contient une série inconnue ou étrangère.',
    };
    return messages[code] ?? 'Ordre invalide.';
  }
}
