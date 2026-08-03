import { Injectable } from '@nestjs/common';
import type {
  EquipmentTypeReference,
  MuscleGroupReference,
} from '@gym-companion/shared';

import { PrismaService } from '../../database/prisma/prisma.service';
import {
  toEquipmentTypeReference,
  toMuscleGroupReference,
} from './reference.mapper';

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async listMuscleGroups(): Promise<MuscleGroupReference[]> {
    const rows = await this.prisma.muscleGroup.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    return rows.map(toMuscleGroupReference);
  }

  async listEquipmentTypes(): Promise<EquipmentTypeReference[]> {
    const rows = await this.prisma.equipmentType.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    return rows.map(toEquipmentTypeReference);
  }
}
