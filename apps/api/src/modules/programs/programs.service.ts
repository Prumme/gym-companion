import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProgramDetail, ProgramListResponse } from '@gym-companion/shared';
import type { Prisma } from '@prisma/client';
import {
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
  reorderWorkoutTemplateExercisesSchema,
  reorderWorkoutTemplatesSchema,
  reorderWorkoutTemplateSetsSchema,
  updateProgramSchema,
  updateWorkoutTemplateExerciseSchema,
  updateWorkoutTemplateSchema,
  updateWorkoutTemplateSetSchema,
  validateWorkoutTemplateExerciseReorder,
  validateWorkoutTemplateReorder,
  validateWorkoutTemplateSetReorder,
  validateWorkoutTemplateSetTargets,
  type WorkoutTemplateSetTargetFields,
} from '@gym-companion/validation';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toProgramDetail,
  toProgramListItem,
  type ProgramRow,
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

    return {
      data: pageRows.map((row) => toProgramListItem(row as ProgramRow)),
      pagination: { nextCursor, hasMore },
    };
  }

  async getById(userId: string, programId: string): Promise<ProgramDetail> {
    const row = await this.findOwnedOrThrow(userId, programId);
    return toProgramDetail(row);
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
    return toProgramDetail(created as ProgramRow);
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
    return toProgramDetail(updated as ProgramRow);
  }

  async archive(userId: string, programId: string): Promise<ProgramDetail> {
    const existing = await this.findOwnedOrThrow(userId, programId);
    if (existing.archivedAt) {
      throw new BadRequestException({
        code: 'PROGRAM_ALREADY_ARCHIVED',
        message: 'Ce programme est déjà archivé.',
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
    return toProgramDetail(archived as ProgramRow);
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
      },
      include: programDetailInclude,
    });
    return toProgramDetail(restored as ProgramRow);
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
