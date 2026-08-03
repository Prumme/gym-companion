import type {
  EquipmentTypeReference,
  ExerciseMeasurementType,
  ExerciseSource,
  MuscleGroupReference,
  ProgramDetail,
  ProgramListItem,
  ProgramPermissions,
  ProgramStatus,
  TrainingGoal,
  WorkoutSetType,
  WorkoutTemplateDetail,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateExerciseRef,
  WorkoutTemplateSetTarget,
  WorkoutTemplateSummary,
} from '@gym-companion/shared';

export type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  goal: TrainingGoal;
  status: ProgramStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ownerUserId: string;
  _count?: { workoutTemplates: number };
  workoutTemplates?: WorkoutTemplateRow[];
};

export type WorkoutTemplateSetRow = {
  id: string;
  position: number;
  setType: WorkoutSetType;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: unknown;
  targetWeightKg: unknown;
  targetIntensityPercent: unknown;
  targetRir: number | null;
  targetRpe: unknown;
  restSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkoutTemplateExerciseRow = {
  id: string;
  position: number;
  restSecondsOverride: number | null;
  notes: string | null;
  exercise: {
    id: string;
    source: ExerciseSource;
    name: string;
    measurementType: ExerciseMeasurementType;
    archivedAt: Date | null;
    primaryMuscleGroup: {
      id: string;
      code: string;
      name: string;
      parentId: string | null;
    };
    defaultEquipmentType: {
      id: string;
      code: string;
      name: string;
    } | null;
  };
  equipmentType: {
    id: string;
    code: string;
    name: string;
  } | null;
  sets: WorkoutTemplateSetRow[];
};

export type WorkoutTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  positionInProgram: number;
  estimatedDurationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { exercises: number };
  exercises?: WorkoutTemplateExerciseRow[];
};

function decimalToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
}

function toMuscle(row: {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}): MuscleGroupReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
  };
}

function toEquipment(row: {
  id: string;
  code: string;
  name: string;
} | null): EquipmentTypeReference | null {
  if (!row) {
    return null;
  }
  return { id: row.id, code: row.code, name: row.name };
}

export function computeProgramPermissions(
  archivedAt: Date | null,
): ProgramPermissions {
  const archived = archivedAt !== null;
  return {
    canEdit: !archived,
    canArchive: !archived,
    canRestore: archived,
  };
}

export function toWorkoutTemplateExerciseRef(
  exercise: WorkoutTemplateExerciseRow['exercise'],
): WorkoutTemplateExerciseRef {
  return {
    id: exercise.id,
    source: exercise.source,
    name: exercise.name,
    measurementType: exercise.measurementType,
    primaryMuscleGroup: toMuscle(exercise.primaryMuscleGroup),
    defaultEquipmentType: toEquipment(exercise.defaultEquipmentType),
    archivedAt: exercise.archivedAt?.toISOString() ?? null,
  };
}

export function toWorkoutTemplateSetTarget(
  row: WorkoutTemplateSetRow,
): WorkoutTemplateSetTarget {
  return {
    id: row.id,
    position: row.position,
    setType: row.setType,
    targetRepMin: row.targetRepMin,
    targetRepMax: row.targetRepMax,
    targetDurationSeconds: row.targetDurationSeconds,
    targetDistanceMeters: decimalToNumber(row.targetDistanceMeters),
    targetWeightKg: decimalToNumber(row.targetWeightKg),
    targetIntensityPercent: decimalToNumber(row.targetIntensityPercent),
    targetRir: row.targetRir,
    targetRpe: decimalToNumber(row.targetRpe),
    restSeconds: row.restSeconds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWorkoutTemplateExerciseDetail(
  row: WorkoutTemplateExerciseRow,
  programArchived: boolean,
): WorkoutTemplateExerciseDetail {
  const canMutate = !programArchived;
  return {
    id: row.id,
    position: row.position,
    exercise: toWorkoutTemplateExerciseRef(row.exercise),
    equipmentType: toEquipment(row.equipmentType),
    restSecondsOverride: row.restSecondsOverride,
    notes: row.notes,
    sets: [...row.sets]
      .sort((a, b) => a.position - b.position)
      .map(toWorkoutTemplateSetTarget),
    permissions: {
      canEdit: canMutate,
      canDelete: canMutate,
      canReorder: canMutate,
    },
  };
}

export function toWorkoutTemplateSummary(
  row: WorkoutTemplateRow,
): WorkoutTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.positionInProgram,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    exerciseCount: row._count?.exercises ?? row.exercises?.length ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWorkoutTemplateDetail(
  row: WorkoutTemplateRow,
  programArchived: boolean,
): WorkoutTemplateDetail {
  const exercises = [...(row.exercises ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  return {
    ...toWorkoutTemplateSummary({
      ...row,
      _count: { exercises: exercises.length },
    }),
    exercises: exercises.map((item) =>
      toWorkoutTemplateExerciseDetail(item, programArchived),
    ),
  };
}

export function toProgramListItem(row: ProgramRow): ProgramListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    goal: row.goal,
    status: row.status,
    workoutTemplateCount: row._count?.workoutTemplates ?? row.workoutTemplates?.length ?? 0,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissions: computeProgramPermissions(row.archivedAt),
  };
}

export function toProgramDetail(row: ProgramRow): ProgramDetail {
  const templates = [...(row.workoutTemplates ?? [])].sort(
    (a, b) => a.positionInProgram - b.positionInProgram,
  );
  const archived = row.archivedAt !== null;
  return {
    ...toProgramListItem({
      ...row,
      _count: { workoutTemplates: templates.length },
    }),
    workoutTemplates: templates.map((template) =>
      toWorkoutTemplateDetail(template, archived),
    ),
  };
}
