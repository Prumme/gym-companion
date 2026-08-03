'use strict';

const { PrismaClient } = require('@prisma/client');

const seedData = require('../src/modules/reference/reference-seed-data.json');

const EQUIPMENT_TYPES = seedData.equipmentTypes;
const MUSCLE_GROUPS = seedData.muscleGroups;

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

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedEquipmentTypes(prisma);
    await seedMuscleGroups(prisma);
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
  seedEquipmentTypes,
  seedMuscleGroups,
};
