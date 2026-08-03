import type {
  EquipmentTypeReference,
  ExerciseCompatibleEquipment,
  ExerciseDetail,
  ExerciseListItem,
  ExercisePermissions,
  ExerciseSource,
  ExerciseUserPreference,
  MuscleGroupReference,
} from '@gym-companion/shared';

type MuscleRef = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
};

type EquipmentRef = {
  id: string;
  code: string;
  name: string;
};

export type PreferenceRow = {
  isFavorite: boolean;
  isExcludedFromSuggestions: boolean;
  restSecondsOverride: number | null;
  preferredEquipmentType: EquipmentRef | null;
};

export type ExerciseListRow = {
  id: string;
  source: ExerciseSource;
  name: string;
  measurementType: ExerciseDetail['measurementType'];
  defaultRestSeconds: number | null;
  archivedAt: Date | null;
  ownerUserId: string | null;
  primaryMuscleGroup: MuscleRef;
  defaultEquipmentType: EquipmentRef | null;
  userPreferences?: PreferenceRow[];
};

export type ExerciseRow = ExerciseListRow & {
  instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
  secondaryMuscles: Array<{ muscleGroup: MuscleRef }>;
  compatibleEquipment: Array<{
    isPreferred: boolean;
    notes: string | null;
    equipmentType: EquipmentRef;
  }>;
};

export const DEFAULT_EXERCISE_USER_PREFERENCE: ExerciseUserPreference = {
  isFavorite: false,
  isExcludedFromSuggestions: false,
  preferredEquipmentType: null,
  restSecondsOverride: null,
};

function toMuscleGroupReference(row: MuscleRef): MuscleGroupReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
  };
}

function toEquipmentTypeReference(row: EquipmentRef): EquipmentTypeReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
  };
}

export function computeExercisePermissions(
  source: ExerciseSource,
  archivedAt: Date | null,
  viewerUserId: string,
  ownerUserId: string | null,
): ExercisePermissions {
  const isOwner = source === 'USER' && ownerUserId === viewerUserId;
  if (!isOwner) {
    return { canEdit: false, canArchive: false, canRestore: false };
  }
  const archived = archivedAt !== null;
  return {
    canEdit: !archived,
    canArchive: !archived,
    canRestore: archived,
  };
}

export function toExerciseUserPreference(
  row: PreferenceRow | null | undefined,
): ExerciseUserPreference {
  if (!row) {
    return { ...DEFAULT_EXERCISE_USER_PREFERENCE };
  }

  return {
    isFavorite: row.isFavorite,
    isExcludedFromSuggestions: row.isExcludedFromSuggestions,
    preferredEquipmentType: row.preferredEquipmentType
      ? toEquipmentTypeReference(row.preferredEquipmentType)
      : null,
    restSecondsOverride: row.restSecondsOverride,
  };
}

function preferenceFromExerciseRow(
  row: Pick<ExerciseListRow, 'userPreferences'>,
): ExerciseUserPreference {
  return toExerciseUserPreference(row.userPreferences?.[0]);
}

export function toExerciseListItem(
  row: ExerciseListRow,
  viewerUserId: string,
): ExerciseListItem {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    measurementType: row.measurementType,
    primaryMuscleGroup: toMuscleGroupReference(row.primaryMuscleGroup),
    defaultEquipmentType: row.defaultEquipmentType
      ? toEquipmentTypeReference(row.defaultEquipmentType)
      : null,
    defaultRestSeconds: row.defaultRestSeconds,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    permissions: computeExercisePermissions(
      row.source,
      row.archivedAt,
      viewerUserId,
      row.ownerUserId,
    ),
    userPreference: preferenceFromExerciseRow(row),
  };
}

export function toExerciseDetail(row: ExerciseRow, viewerUserId: string): ExerciseDetail {
  const compatibleEquipmentTypes: ExerciseCompatibleEquipment[] =
    row.compatibleEquipment.map((item) => ({
      equipmentType: toEquipmentTypeReference(item.equipmentType),
      isPreferred: item.isPreferred,
      notes: item.notes,
    }));

  return {
    id: row.id,
    source: row.source,
    name: row.name,
    measurementType: row.measurementType,
    primaryMuscleGroup: toMuscleGroupReference(row.primaryMuscleGroup),
    secondaryMuscleGroups: row.secondaryMuscles.map((item) =>
      toMuscleGroupReference(item.muscleGroup),
    ),
    defaultEquipmentType: row.defaultEquipmentType
      ? toEquipmentTypeReference(row.defaultEquipmentType)
      : null,
    compatibleEquipmentTypes,
    defaultRestSeconds: row.defaultRestSeconds,
    instructions: row.instructions,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissions: computeExercisePermissions(
      row.source,
      row.archivedAt,
      viewerUserId,
      row.ownerUserId,
    ),
    userPreference: preferenceFromExerciseRow(row),
  };
}
