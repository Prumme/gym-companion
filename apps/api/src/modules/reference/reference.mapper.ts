import type {
  EquipmentTypeReference,
  MuscleGroupReference,
} from '@gym-companion/shared';

type MuscleGroupRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type EquipmentTypeRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toMuscleGroupReference(row: MuscleGroupRow): MuscleGroupReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
  };
}

export function toEquipmentTypeReference(row: EquipmentTypeRow): EquipmentTypeReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
  };
}
