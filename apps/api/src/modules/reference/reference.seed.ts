import type { PrismaClient } from '@prisma/client';

import seedData from './reference-seed-data.json';

export const EQUIPMENT_TYPES = seedData.equipmentTypes;
export const MUSCLE_GROUPS = seedData.muscleGroups;

type PrismaLike = Pick<PrismaClient, 'equipmentType' | 'muscleGroup'>;

export async function seedEquipmentTypes(prisma: PrismaLike): Promise<void> {
  for (const item of EQUIPMENT_TYPES) {
    await prisma.equipmentType.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        isActive: true,
      },
      // Ne pas écraser isActive : une désactivation manuelle doit être conservée.
      update: {
        name: item.name,
      },
    });
  }
}

export async function seedMuscleGroups(prisma: PrismaLike): Promise<void> {
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

export async function seedReferenceData(prisma: PrismaLike): Promise<void> {
  await seedEquipmentTypes(prisma);
  await seedMuscleGroups(prisma);
}
