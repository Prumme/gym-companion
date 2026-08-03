import { normalizeExerciseName } from '@gym-companion/validation';
import type { ExerciseMeasurementType, PrismaClient } from '@prisma/client';

import seedExercises from './exercises-seed-data.json';

type PrismaLike = Pick<
  PrismaClient,
  'muscleGroup' | 'equipmentType' | 'exercise' | 'exerciseSecondaryMuscle' | 'exerciseEquipmentCompatibility'
>;

type SeedExercise = (typeof seedExercises)[number];

export const SYSTEM_EXERCISE_SEEDS = seedExercises;

async function syncExerciseRelations(
  prisma: PrismaLike,
  exerciseId: string,
  definition: SeedExercise,
  muscleByCode: Map<string, string>,
  equipmentByCode: Map<string, string>,
) {
  await prisma.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId } });
  await prisma.exerciseEquipmentCompatibility.deleteMany({ where: { exerciseId } });

  if (definition.secondaryMuscleCodes.length > 0) {
    await prisma.exerciseSecondaryMuscle.createMany({
      data: definition.secondaryMuscleCodes.map((code) => {
        const muscleGroupId = muscleByCode.get(code);
        if (!muscleGroupId) {
          throw new Error(`Missing muscle group code for seed: ${code}`);
        }
        return { exerciseId, muscleGroupId };
      }),
      skipDuplicates: true,
    });
  }

  if (definition.compatibleEquipmentCodes.length > 0) {
    const defaultCode = definition.defaultEquipmentCode;
    await prisma.exerciseEquipmentCompatibility.createMany({
      data: definition.compatibleEquipmentCodes.map((code) => {
        const equipmentTypeId = equipmentByCode.get(code);
        if (!equipmentTypeId) {
          throw new Error(`Missing equipment type code for seed: ${code}`);
        }
        return {
          exerciseId,
          equipmentTypeId,
          isPreferred: code === defaultCode,
          notes: null,
        };
      }),
      skipDuplicates: true,
    });
  }
}

export async function seedSystemExercises(prisma: PrismaLike): Promise<void> {
  const muscles = await prisma.muscleGroup.findMany();
  const equipment = await prisma.equipmentType.findMany();
  const muscleByCode = new Map(muscles.map((item) => [item.code, item.id]));
  const equipmentByCode = new Map(equipment.map((item) => [item.code, item.id]));

  for (const definition of SYSTEM_EXERCISE_SEEDS) {
    const primaryMuscleGroupId = muscleByCode.get(definition.primaryMuscleCode);
    const defaultEquipmentTypeId = equipmentByCode.get(definition.defaultEquipmentCode);

    if (!primaryMuscleGroupId) {
      throw new Error(`Missing primary muscle for seed: ${definition.primaryMuscleCode}`);
    }
    if (!defaultEquipmentTypeId) {
      throw new Error(
        `Missing default equipment for seed: ${definition.defaultEquipmentCode}`,
      );
    }

    const existing = await prisma.exercise.findUnique({
      where: { slug: definition.slug },
    });

    if (!existing) {
      const created = await prisma.exercise.create({
        data: {
          source: 'SYSTEM',
          ownerUserId: null,
          name: definition.name,
          normalizedName: normalizeExerciseName(definition.name),
          slug: definition.slug,
          primaryMuscleGroupId,
          measurementType: definition.measurementType as ExerciseMeasurementType,
          defaultEquipmentTypeId,
          defaultRestSeconds: definition.defaultRestSeconds,
          instructions: definition.instructions,
        },
      });
      await syncExerciseRelations(
        prisma,
        created.id,
        definition,
        muscleByCode,
        equipmentByCode,
      );
      continue;
    }

    // Préserve archivedAt ; resynchronise la structure catalogue système.
    await prisma.exercise.update({
      where: { id: existing.id },
      data: {
        name: definition.name,
        normalizedName: normalizeExerciseName(definition.name),
        primaryMuscleGroupId,
        measurementType: definition.measurementType as ExerciseMeasurementType,
        defaultEquipmentTypeId,
        defaultRestSeconds: definition.defaultRestSeconds,
        instructions: definition.instructions,
        source: 'SYSTEM',
        ownerUserId: null,
      },
    });
    await syncExerciseRelations(
      prisma,
      existing.id,
      definition,
      muscleByCode,
      equipmentByCode,
    );
  }
}
