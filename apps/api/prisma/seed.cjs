'use strict';

const { PrismaClient } = require('@prisma/client');

const referenceData = require('../src/modules/reference/reference-seed-data.json');
const exerciseData = require('../src/modules/exercises/exercises-seed-data.json');

const EQUIPMENT_TYPES = referenceData.equipmentTypes;
const MUSCLE_GROUPS = referenceData.muscleGroups;
const SYSTEM_EXERCISES = exerciseData;

function normalizeExerciseName(name) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedEquipmentTypes(prisma) {
  for (const item of EQUIPMENT_TYPES) {
    await prisma.equipmentType.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        isActive: true,
      },
      update: {
        name: item.name,
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedMuscleGroups(prisma) {
  for (const item of MUSCLE_GROUPS) {
    await prisma.muscleGroup.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        parentId: null,
        isActive: true,
      },
      update: {
        name: item.name,
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} exerciseId
 * @param {any} definition
 * @param {Map<string, string>} muscleByCode
 * @param {Map<string, string>} equipmentByCode
 */
async function syncExerciseRelations(
  prisma,
  exerciseId,
  definition,
  muscleByCode,
  equipmentByCode,
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
    });
  }

  if (definition.compatibleEquipmentCodes.length > 0) {
    await prisma.exerciseEquipmentCompatibility.createMany({
      data: definition.compatibleEquipmentCodes.map((code) => {
        const equipmentTypeId = equipmentByCode.get(code);
        if (!equipmentTypeId) {
          throw new Error(`Missing equipment type code for seed: ${code}`);
        }
        return {
          exerciseId,
          equipmentTypeId,
          isPreferred: code === definition.defaultEquipmentCode,
          notes: null,
        };
      }),
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function seedSystemExercises(prisma) {
  const muscles = await prisma.muscleGroup.findMany();
  const equipment = await prisma.equipmentType.findMany();
  const muscleByCode = new Map(muscles.map((item) => [item.code, item.id]));
  const equipmentByCode = new Map(equipment.map((item) => [item.code, item.id]));

  for (const definition of SYSTEM_EXERCISES) {
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
          measurementType: definition.measurementType,
          category: definition.category,
          cardioType: definition.cardioType,
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

    await prisma.exercise.update({
      where: { id: existing.id },
      data: {
        name: definition.name,
        normalizedName: normalizeExerciseName(definition.name),
        primaryMuscleGroupId,
        measurementType: definition.measurementType,
        category: definition.category,
        cardioType: definition.cardioType,
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

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedEquipmentTypes(prisma);
    await seedMuscleGroups(prisma);
    await seedSystemExercises(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  SYSTEM_EXERCISES,
  seedEquipmentTypes,
  seedMuscleGroups,
  seedSystemExercises,
  normalizeExerciseName,
};
