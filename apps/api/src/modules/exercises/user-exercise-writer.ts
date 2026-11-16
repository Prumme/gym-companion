import { BadRequestException } from '@nestjs/common';
import { normalizeExerciseName, type CreateExerciseInput } from '@gym-companion/validation';
import type { Prisma } from '@prisma/client';

/** Client Prisma (ou transaction) capable de lire les référentiels. */
type ReferenceReader = Pick<Prisma.TransactionClient, 'muscleGroup' | 'equipmentType'>;

/**
 * Vérifie que les groupes musculaires et équipements référencés par un
 * exercice personnel existent et sont actifs. Partagé entre la création
 * manuelle et l’import d’un exercice partagé.
 */
export async function assertExerciseRelations(
  db: ReferenceReader,
  data: CreateExerciseInput,
): Promise<void> {
  const primary = await db.muscleGroup.findFirst({
    where: { id: data.primaryMuscleGroupId, isActive: true },
  });
  if (!primary) {
    throw new BadRequestException({
      code: 'EXERCISE_INVALID_PRIMARY_MUSCLE',
      message: 'Groupe musculaire principal invalide.',
    });
  }

  if (data.secondaryMuscleGroupIds.length > 0) {
    const secondaries = await db.muscleGroup.findMany({
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
    const types = await db.equipmentType.findMany({
      where: { id: { in: equipmentIds }, isActive: true },
    });
    if (types.length !== equipmentIds.length) {
      throw new BadRequestException({
        code: 'EXERCISE_INVALID_EQUIPMENT_TYPE',
        message: 'Un ou plusieurs types d’équipement sont invalides.',
      });
    }
  }

  if (data.defaultEquipmentTypeId && !equipmentIds.includes(data.defaultEquipmentTypeId)) {
    throw new BadRequestException({
      code: 'EXERCISE_DEFAULT_EQUIPMENT_NOT_COMPATIBLE',
      message: 'L’équipement par défaut doit être compatible.',
    });
  }
}

/** Données de création d’un exercice personnel (USER) appartenant à `userId`. */
export function buildUserExerciseCreateData(
  userId: string,
  data: CreateExerciseInput,
): Prisma.ExerciseUncheckedCreateInput {
  return {
    source: 'USER',
    ownerUserId: userId,
    name: data.name.trim(),
    normalizedName: normalizeExerciseName(data.name),
    slug: null,
    primaryMuscleGroupId: data.primaryMuscleGroupId,
    measurementType: data.measurementType,
    category: data.category,
    cardioType: data.category === 'CARDIO' ? (data.cardioType ?? null) : null,
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
  };
}
