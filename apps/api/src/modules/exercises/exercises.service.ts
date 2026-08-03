import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ExerciseListResponse,
  ExerciseUserPreference,
} from '@gym-companion/shared';
import {
  buildExerciseCursorFilter,
  createExerciseSchema,
  decodeExerciseCursor,
  encodeExerciseCursor,
  isDefaultExercisePreferenceInput,
  listExercisesQuerySchema,
  normalizeExerciseName,
  updateExercisePreferenceSchema,
  updateExerciseSchema,
  type CreateExerciseInput,
  type UpdateExerciseInput,
  type UpdateExercisePreferenceInput,
} from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toExerciseDetail,
  toExerciseListItem,
  toExerciseUserPreference,
  type ExerciseListRow,
  type ExerciseRow,
  type PreferenceRow,
} from './exercises.mapper';

function preferenceIncludeForUser(userId: string) {
  return {
    userPreferences: {
      where: { userId },
      include: { preferredEquipmentType: true },
      take: 1,
    },
  } satisfies Prisma.ExerciseInclude;
}

const exerciseDetailIncludeBase = {
  primaryMuscleGroup: true,
  defaultEquipmentType: true,
  secondaryMuscles: { include: { muscleGroup: true } },
  compatibleEquipment: { include: { equipmentType: true } },
} satisfies Prisma.ExerciseInclude;

const exerciseListIncludeBase = {
  primaryMuscleGroup: true,
  defaultEquipmentType: true,
} satisfies Prisma.ExerciseInclude;

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste paginée des exercices visibles.
   *
   * Convention filtres de référence :
   * - `muscleGroupId` / `equipmentTypeId` inconnus ou inactifs → erreur 400
   *   (`EXERCISE_INVALID_*_FILTER`), pas une liste vide silencieuse.
   */
  async list(userId: string, rawQuery: unknown): Promise<ExerciseListResponse> {
    let query;
    try {
      query = listExercisesQuerySchema.parse(rawQuery);
    } catch (error) {
      if (error && typeof error === 'object' && (error as { name?: string }).name === 'ZodError') {
        throw error;
      }
      throw new BadRequestException({
        code: 'EXERCISE_INVALID_LIST_QUERY',
        message: 'Paramètres de liste invalides.',
      });
    }

    if (query.muscleGroupId) {
      const muscle = await this.prisma.muscleGroup.findFirst({
        where: { id: query.muscleGroupId, isActive: true },
      });
      if (!muscle) {
        throw new BadRequestException({
          code: 'EXERCISE_INVALID_MUSCLE_GROUP_FILTER',
          message: 'Groupe musculaire de filtre invalide ou inactif.',
        });
      }
    }

    if (query.equipmentTypeId) {
      const equipment = await this.prisma.equipmentType.findFirst({
        where: { id: query.equipmentTypeId, isActive: true },
      });
      if (!equipment) {
        throw new BadRequestException({
          code: 'EXERCISE_INVALID_EQUIPMENT_TYPE_FILTER',
          message: 'Type d’équipement de filtre invalide ou inactif.',
        });
      }
    }

    let cursorFilter: ReturnType<typeof buildExerciseCursorFilter> | undefined;
    if (query.cursor) {
      try {
        cursorFilter = buildExerciseCursorFilter(decodeExerciseCursor(query.cursor));
      } catch {
        throw new BadRequestException({
          code: 'EXERCISE_INVALID_CURSOR',
          message: 'Cursor de pagination invalide.',
        });
      }
    }

    const visibility: Prisma.ExerciseWhereInput = {
      OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
    };

    const filters: Prisma.ExerciseWhereInput[] = [visibility];

    if (!query.includeArchived) {
      filters.push({ archivedAt: null });
    }

    if (query.search) {
      filters.push({
        normalizedName: { contains: query.search },
      });
    }

    if (query.muscleGroupId) {
      filters.push({
        OR: [
          { primaryMuscleGroupId: query.muscleGroupId },
          { secondaryMuscles: { some: { muscleGroupId: query.muscleGroupId } } },
        ],
      });
    }

    if (query.equipmentTypeId) {
      filters.push({
        compatibleEquipment: {
          some: { equipmentTypeId: query.equipmentTypeId },
        },
      });
    }

    if (query.measurementType) {
      filters.push({ measurementType: query.measurementType });
    }

    if (query.source) {
      filters.push(
        query.source === 'SYSTEM'
          ? { source: 'SYSTEM' }
          : { source: 'USER', ownerUserId: userId },
      );
    }

    if (query.favoriteOnly) {
      filters.push({
        userPreferences: {
          some: { userId, isFavorite: true },
        },
      });
    }

    if (cursorFilter) {
      filters.push(cursorFilter);
    }

    const rows = await this.prisma.exercise.findMany({
      where: { AND: filters },
      include: {
        ...exerciseListIncludeBase,
        ...preferenceIncludeForUser(userId),
      },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeExerciseCursor({
            version: 1,
            normalizedName: last.normalizedName,
            id: last.id,
          })
        : null;

    return {
      data: pageRows.map((row) =>
        toExerciseListItem(row as ExerciseListRow, userId),
      ),
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  async getById(userId: string, exerciseId: string) {
    const row = await this.findAccessibleOrThrow(userId, exerciseId);
    return toExerciseDetail(row as ExerciseRow, userId);
  }

  async getPreference(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseUserPreference> {
    const row = await this.findAccessibleOrThrow(userId, exerciseId);
    return toExerciseUserPreference(
      (row as ExerciseRow).userPreferences?.[0] as PreferenceRow | undefined,
    );
  }

  /**
   * Upsert idempotent des préférences.
   * Stratégie « ligne vide » : si toutes les valeurs sont les défauts,
   * la ligne est supprimée (contrat API inchangé).
   */
  async upsertPreference(
    userId: string,
    exerciseId: string,
    input: unknown,
  ): Promise<ExerciseUserPreference> {
    const data = updateExercisePreferenceSchema.parse(input);
    await this.findAccessibleOrThrow(userId, exerciseId);
    await this.assertPreferredEquipment(exerciseId, data.preferredEquipmentTypeId);

    if (isDefaultExercisePreferenceInput(data)) {
      await this.prisma.userExercisePreference.deleteMany({
        where: { userId, exerciseId },
      });
      return toExerciseUserPreference(null);
    }

    const saved = await this.prisma.userExercisePreference.upsert({
      where: {
        userId_exerciseId: { userId, exerciseId },
      },
      create: {
        userId,
        exerciseId,
        isFavorite: data.isFavorite,
        isExcludedFromSuggestions: data.isExcludedFromSuggestions,
        preferredEquipmentTypeId: data.preferredEquipmentTypeId,
        restSecondsOverride: data.restSecondsOverride,
      },
      update: {
        isFavorite: data.isFavorite,
        isExcludedFromSuggestions: data.isExcludedFromSuggestions,
        preferredEquipmentTypeId: data.preferredEquipmentTypeId,
        restSecondsOverride: data.restSecondsOverride,
      },
      include: { preferredEquipmentType: true },
    });

    return toExerciseUserPreference(saved as PreferenceRow);
  }

  async deletePreference(userId: string, exerciseId: string): Promise<void> {
    await this.findAccessibleOrThrow(userId, exerciseId);
    await this.prisma.userExercisePreference.deleteMany({
      where: { userId, exerciseId },
    });
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
        include: {
          ...exerciseDetailIncludeBase,
          ...preferenceIncludeForUser(userId),
        },
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
        include: {
          ...exerciseDetailIncludeBase,
          ...preferenceIncludeForUser(userId),
        },
      });
    });

    return toExerciseDetail(updated as ExerciseRow, userId);
  }

  async archive(userId: string, exerciseId: string) {
    await this.findOwnedEditableOrThrow(userId, exerciseId);
    const archived = await this.prisma.exercise.update({
      where: { id: exerciseId },
      data: { archivedAt: new Date() },
      include: {
        ...exerciseDetailIncludeBase,
        ...preferenceIncludeForUser(userId),
      },
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
      include: {
        ...exerciseDetailIncludeBase,
        ...preferenceIncludeForUser(userId),
      },
    });
    return toExerciseDetail(restored as ExerciseRow, userId);
  }

  private async findAccessibleOrThrow(userId: string, exerciseId: string) {
    const row = await this.prisma.exercise.findFirst({
      where: {
        id: exerciseId,
        OR: [{ source: 'SYSTEM' }, { source: 'USER', ownerUserId: userId }],
      },
      include: {
        ...exerciseDetailIncludeBase,
        ...preferenceIncludeForUser(userId),
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

  private async findOwnedOrThrow(userId: string, exerciseId: string) {
    const row = await this.prisma.exercise.findFirst({
      where: { id: exerciseId },
      include: {
        ...exerciseDetailIncludeBase,
        ...preferenceIncludeForUser(userId),
      },
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

  private async assertPreferredEquipment(
    exerciseId: string,
    preferredEquipmentTypeId: string | null,
  ) {
    if (preferredEquipmentTypeId === null) {
      return;
    }

    const equipment = await this.prisma.equipmentType.findFirst({
      where: { id: preferredEquipmentTypeId, isActive: true },
    });
    if (!equipment) {
      throw new BadRequestException({
        code: 'EXERCISE_PREFERRED_EQUIPMENT_NOT_COMPATIBLE',
        message: 'Type d’équipement préféré invalide ou inactif.',
      });
    }

    const compatible = await this.prisma.exerciseEquipmentCompatibility.findFirst({
      where: { exerciseId, equipmentTypeId: preferredEquipmentTypeId },
    });
    if (!compatible) {
      throw new BadRequestException({
        code: 'EXERCISE_PREFERRED_EQUIPMENT_NOT_COMPATIBLE',
        message: 'Le type d’équipement préféré n’est pas compatible avec cet exercice.',
      });
    }
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

export type { UpdateExerciseInput, UpdateExercisePreferenceInput };
