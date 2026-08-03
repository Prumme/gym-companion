import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createExerciseSchema,
  normalizeExerciseName,
  updateExerciseSchema,
  type CreateExerciseInput,
  type UpdateExerciseInput,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toExerciseDetail,
  toExerciseListItem,
  type ExerciseRow,
} from './exercises.mapper';

const LIST_LIMIT = 500;

const exerciseDetailInclude = {
  primaryMuscleGroup: true,
  defaultEquipmentType: true,
  secondaryMuscles: { include: { muscleGroup: true } },
  compatibleEquipment: { include: { equipmentType: true } },
} satisfies Prisma.ExerciseInclude;

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, includeArchived: boolean) {
    const rows = await this.prisma.exercise.findMany({
      where: {
        AND: [
          {
            OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
          },
          includeArchived ? {} : { archivedAt: null },
        ],
      },
      include: exerciseDetailInclude,
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: LIST_LIMIT,
    });

    return rows.map((row) => toExerciseListItem(row as ExerciseRow, userId));
  }

  async getById(userId: string, exerciseId: string) {
    const row = await this.findAccessibleOrThrow(userId, exerciseId);
    return toExerciseDetail(row as ExerciseRow, userId);
  }

  async create(userId: string, input: unknown) {
    const data = createExerciseSchema.parse(input);
    await this.assertRelations(data);

    const created = await this.prisma.$transaction(async (tx) => {
      const exercise = await tx.exercise.create({
        data: {
          source: 'USER',
          ownerUserId: userId,
          name: data.name.trim(),
          normalizedName: normalizeExerciseName(data.name),
          slug: null,
          primaryMuscleGroupId: data.primaryMuscleGroupId,
          measurementType: data.measurementType,
          defaultEquipmentTypeId: data.defaultEquipmentTypeId ?? null,
          defaultRestSeconds: data.defaultRestSeconds ?? null,
          instructions: data.instructions ?? null,
          secondaryMuscles: {
            create: data.secondaryMuscleGroupIds.map((muscleGroupId) => ({
              muscleGroupId,
            })),
          },
          compatibleEquipment: {
            create: data.compatibleEquipmentTypes.map((item) => ({
              equipmentTypeId: item.equipmentTypeId,
              isPreferred: item.isPreferred,
              notes: item.notes ?? null,
            })),
          },
        },
        include: exerciseDetailInclude,
      });
      return exercise;
    });

    return toExerciseDetail(created as ExerciseRow, userId);
  }

  async update(userId: string, exerciseId: string, input: unknown) {
    const data = updateExerciseSchema.parse(input);
    const existing = await this.findOwnedEditableOrThrow(userId, exerciseId);

    const merged: CreateExerciseInput = {
      name: data.name ?? existing.name,
      primaryMuscleGroupId: data.primaryMuscleGroupId ?? existing.primaryMuscleGroupId,
      secondaryMuscleGroupIds:
        data.secondaryMuscleGroupIds ??
        existing.secondaryMuscles.map((item) => item.muscleGroupId),
      measurementType: data.measurementType ?? existing.measurementType,
      defaultEquipmentTypeId:
        data.defaultEquipmentTypeId !== undefined
          ? data.defaultEquipmentTypeId
          : existing.defaultEquipmentTypeId,
      compatibleEquipmentTypes:
        data.compatibleEquipmentTypes ??
        existing.compatibleEquipment.map((item) => ({
          equipmentTypeId: item.equipmentTypeId,
          isPreferred: item.isPreferred,
          notes: item.notes,
        })),
      defaultRestSeconds:
        data.defaultRestSeconds !== undefined
          ? data.defaultRestSeconds
          : existing.defaultRestSeconds,
      instructions:
        data.instructions !== undefined ? data.instructions : existing.instructions,
    };

    // Re-validate merged payload (defaults + partial patch).
    const validated = createExerciseSchema.parse(merged);
    await this.assertRelations(validated);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId } });
      await tx.exerciseEquipmentCompatibility.deleteMany({ where: { exerciseId } });

      return tx.exercise.update({
        where: { id: exerciseId },
        data: {
          name: validated.name.trim(),
          normalizedName: normalizeExerciseName(validated.name),
          primaryMuscleGroupId: validated.primaryMuscleGroupId,
          measurementType: validated.measurementType,
          defaultEquipmentTypeId: validated.defaultEquipmentTypeId ?? null,
          defaultRestSeconds: validated.defaultRestSeconds ?? null,
          instructions: validated.instructions ?? null,
          secondaryMuscles: {
            create: validated.secondaryMuscleGroupIds.map((muscleGroupId) => ({
              muscleGroupId,
            })),
          },
          compatibleEquipment: {
            create: validated.compatibleEquipmentTypes.map((item) => ({
              equipmentTypeId: item.equipmentTypeId,
              isPreferred: item.isPreferred,
              notes: item.notes ?? null,
            })),
          },
        },
        include: exerciseDetailInclude,
      });
    });

    return toExerciseDetail(updated as ExerciseRow, userId);
  }

  async archive(userId: string, exerciseId: string) {
    await this.findOwnedEditableOrThrow(userId, exerciseId);
    const archived = await this.prisma.exercise.update({
      where: { id: exerciseId },
      data: { archivedAt: new Date() },
      include: exerciseDetailInclude,
    });
    return toExerciseDetail(archived as ExerciseRow, userId);
  }

  async restore(userId: string, exerciseId: string) {
    const existing = await this.findOwnedOrThrow(userId, exerciseId);
    if (existing.archivedAt === null) {
      throw new BadRequestException({
        code: 'EXERCISE_NOT_ARCHIVED',
        message: 'Cet exercice n’est pas archivé.',
      });
    }

    const restored = await this.prisma.exercise.update({
      where: { id: exerciseId },
      data: { archivedAt: null },
      include: exerciseDetailInclude,
    });
    return toExerciseDetail(restored as ExerciseRow, userId);
  }

  private async findAccessibleOrThrow(userId: string, exerciseId: string) {
    const row = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      },
      include: exerciseDetailInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }
    return row;
  }

  private async findOwnedOrThrow(userId: string, exerciseId: string) {
    const row = await this.prisma.exercise.findFirst({
      where: { id: exerciseId },
      include: exerciseDetailInclude,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }

    if (row.source === 'SYSTEM') {
      throw new ForbiddenException({
        code: 'EXERCISE_NOT_EDITABLE',
        message: 'Les exercices système ne sont pas modifiables.',
      });
    }

    if (row.ownerUserId !== userId) {
      throw new NotFoundException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercice introuvable.',
      });
    }

    return row;
  }

  private async findOwnedEditableOrThrow(userId: string, exerciseId: string) {
    const row = await this.findOwnedOrThrow(userId, exerciseId);
    if (row.archivedAt) {
      throw new BadRequestException({
        code: 'EXERCISE_ALREADY_ARCHIVED',
        message: 'Un exercice archivé ne peut pas être modifié.',
      });
    }
    return row;
  }

  private async assertRelations(data: CreateExerciseInput) {
    const primary = await this.prisma.muscleGroup.findFirst({
      where: { id: data.primaryMuscleGroupId, isActive: true },
    });
    if (!primary) {
      throw new BadRequestException({
        code: 'EXERCISE_INVALID_PRIMARY_MUSCLE',
        message: 'Groupe musculaire principal invalide.',
      });
    }

    if (data.secondaryMuscleGroupIds.length > 0) {
      const secondaries = await this.prisma.muscleGroup.findMany({
        where: {
          id: { in: data.secondaryMuscleGroupIds },
          isActive: true,
        },
      });
      if (secondaries.length !== data.secondaryMuscleGroupIds.length) {
        throw new BadRequestException({
          code: 'EXERCISE_INVALID_SECONDARY_MUSCLE',
          message: 'Un ou plusieurs groupes secondaires sont invalides.',
        });
      }
      if (data.secondaryMuscleGroupIds.includes(data.primaryMuscleGroupId)) {
        throw new BadRequestException({
          code: 'EXERCISE_DUPLICATE_SECONDARY_MUSCLE',
          message: 'Le groupe principal ne peut pas être secondaire.',
        });
      }
    }

    const equipmentIds = data.compatibleEquipmentTypes.map((item) => item.equipmentTypeId);
    if (equipmentIds.length > 0) {
      const types = await this.prisma.equipmentType.findMany({
        where: { id: { in: equipmentIds }, isActive: true },
      });
      if (types.length !== equipmentIds.length) {
        throw new BadRequestException({
          code: 'EXERCISE_INVALID_EQUIPMENT_TYPE',
          message: 'Un ou plusieurs types d’équipement sont invalides.',
        });
      }
    }

    if (
      data.defaultEquipmentTypeId &&
      !equipmentIds.includes(data.defaultEquipmentTypeId)
    ) {
      throw new BadRequestException({
        code: 'EXERCISE_DEFAULT_EQUIPMENT_NOT_COMPATIBLE',
        message: 'L’équipement par défaut doit être compatible.',
      });
    }
  }
}

export type { UpdateExerciseInput };
