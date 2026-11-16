import { createHash, randomBytes } from 'node:crypto';

import type {
  SharedExerciseDefinition,
  SharedExerciseSnapshotV1,
  SharedProgramSnapshotV1,
  SharedTemplateExercise,
  SharedTemplateSet,
  SharedWorkoutTemplateBody,
  SharedWorkoutTemplateSnapshotV1,
  TrainingShareSnapshot,
} from '@gym-companion/validation';
import { trainingShareSnapshotSchema } from '@gym-companion/validation';

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return Number(value);
}

type SetRow = {
  setType: SharedTemplateSet['setType'];
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: unknown;
  targetWeightKg: unknown;
  targetIntensityPercent: unknown;
  targetRir: number | null;
  targetRpe: unknown;
  restSeconds: number | null;
};

/** Champs d’un exercice nécessaires pour le décrire dans un partage. */
export type ExerciseDefinitionRow = {
  id: string;
  source: 'SYSTEM' | 'USER';
  name: string;
  measurementType: SharedExerciseDefinition['measurementType'];
  category: SharedExerciseDefinition['category'];
  cardioType: SharedExerciseDefinition['cardioType'];
  primaryMuscleGroupId: string;
  defaultEquipmentTypeId: string | null;
  defaultRestSeconds: number | null;
  instructions: string | null;
  secondaryMuscles: Array<{ muscleGroupId: string }>;
  compatibleEquipment: Array<{
    equipmentTypeId: string;
    isPreferred: boolean;
    notes: string | null;
  }>;
};

type ExerciseRow = {
  exerciseId: string;
  exercise: ExerciseDefinitionRow;
  equipmentTypeId: string | null;
  notes: string | null;
  restSecondsOverride: number | null;
  sets: SetRow[];
};

type TemplateRow = {
  name: string;
  description: string | null;
  estimatedDurationMinutes: number | null;
  exercises: ExerciseRow[];
};

/** Clés stables des exercices personnels d’un partage, par ordre d’apparition. */
type PersonalExerciseRegistry = {
  keyByExerciseId: Map<string, string>;
  definitions: SharedExerciseDefinition[];
};

export function generateTrainingShareToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashTrainingShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function serializeSetForShare(set: SetRow): SharedTemplateSet {
  return {
    setType: set.setType,
    targetRepMin: set.targetRepMin,
    targetRepMax: set.targetRepMax,
    targetDurationSeconds: set.targetDurationSeconds,
    targetDistanceMeters: decimalToNumber(set.targetDistanceMeters),
    targetWeightKg: decimalToNumber(set.targetWeightKg),
    targetIntensityPercent: decimalToNumber(set.targetIntensityPercent),
    targetRir: set.targetRir,
    targetRpe: decimalToNumber(set.targetRpe),
    restSeconds: set.restSeconds,
  };
}

export function serializeExerciseDefinitionForShare(
  exercise: ExerciseDefinitionRow,
  key: string,
): SharedExerciseDefinition {
  return {
    key,
    name: exercise.name.trim(),
    measurementType: exercise.measurementType,
    category: exercise.category,
    cardioType: exercise.category === 'CARDIO' ? exercise.cardioType : null,
    primaryMuscleGroupId: exercise.primaryMuscleGroupId,
    secondaryMuscleGroupIds: exercise.secondaryMuscles.map((item) => item.muscleGroupId),
    defaultEquipmentTypeId: exercise.defaultEquipmentTypeId,
    compatibleEquipmentTypes: exercise.compatibleEquipment.map((item) => ({
      equipmentTypeId: item.equipmentTypeId,
      isPreferred: item.isPreferred,
      notes: item.notes,
    })),
    defaultRestSeconds: exercise.defaultRestSeconds,
    instructions: exercise.instructions,
  };
}

export function serializeExerciseSnapshotForShare(
  exercise: ExerciseDefinitionRow,
): SharedExerciseSnapshotV1 {
  return {
    version: 1,
    kind: 'EXERCISE',
    exercise: serializeExerciseDefinitionForShare(exercise, 'exercise'),
  };
}

function createPersonalExerciseRegistry(): PersonalExerciseRegistry {
  return { keyByExerciseId: new Map(), definitions: [] };
}

function registerPersonalExercise(
  registry: PersonalExerciseRegistry,
  exercise: ExerciseDefinitionRow,
): string {
  const existing = registry.keyByExerciseId.get(exercise.id);
  if (existing) return existing;
  const key = `p${registry.definitions.length + 1}`;
  registry.keyByExerciseId.set(exercise.id, key);
  registry.definitions.push(serializeExerciseDefinitionForShare(exercise, key));
  return key;
}

function serializeExerciseForShare(
  row: ExerciseRow,
  registry: PersonalExerciseRegistry,
): SharedTemplateExercise {
  const isPersonal = row.exercise.source === 'USER';
  return {
    exerciseId: isPersonal ? null : row.exerciseId,
    personalExerciseKey: isPersonal ? registerPersonalExercise(registry, row.exercise) : null,
    equipmentTypeId: row.equipmentTypeId,
    notes: row.notes,
    restSecondsOverride: row.restSecondsOverride,
    sets: row.sets.map(serializeSetForShare),
  };
}

function serializeWorkoutTemplateBodyForShare(
  template: TemplateRow,
  registry: PersonalExerciseRegistry,
): SharedWorkoutTemplateBody {
  return {
    name: template.name.trim(),
    description: template.description,
    estimatedDurationMinutes: template.estimatedDurationMinutes,
    exercises: template.exercises.map((row) => serializeExerciseForShare(row, registry)),
  };
}

function personalExercisesField(registry: PersonalExerciseRegistry) {
  return registry.definitions.length > 0 ? { personalExercises: registry.definitions } : {};
}

export function serializeWorkoutTemplateForShare(
  template: TemplateRow,
): SharedWorkoutTemplateSnapshotV1 {
  const registry = createPersonalExerciseRegistry();
  const body = serializeWorkoutTemplateBodyForShare(template, registry);
  return {
    version: 1,
    kind: 'WORKOUT_TEMPLATE',
    ...body,
    ...personalExercisesField(registry),
  };
}

export function serializeProgramForShare(input: {
  name: string;
  description: string | null;
  goal: SharedProgramSnapshotV1['goal'];
  workouts: TemplateRow[];
}): SharedProgramSnapshotV1 {
  const registry = createPersonalExerciseRegistry();
  const workouts = input.workouts.map((workout) =>
    serializeWorkoutTemplateBodyForShare(workout, registry),
  );
  return {
    version: 1,
    kind: 'PROGRAM',
    name: input.name.trim(),
    description: input.description,
    goal: input.goal,
    workouts,
    ...personalExercisesField(registry),
  };
}

export function parseTrainingShareSnapshot(raw: unknown): TrainingShareSnapshot {
  return trainingShareSnapshotSchema.parse(raw);
}

/** Séances d’un snapshot (aucune pour un partage d’exercice). */
export function workoutsOfSnapshot(snapshot: TrainingShareSnapshot): SharedWorkoutTemplateBody[] {
  if (snapshot.kind === 'PROGRAM') return snapshot.workouts;
  if (snapshot.kind === 'WORKOUT_TEMPLATE') return [snapshot];
  return [];
}

/** Définitions d’exercices personnels portées par un snapshot. */
export function personalExercisesOfSnapshot(
  snapshot: TrainingShareSnapshot,
): SharedExerciseDefinition[] {
  if (snapshot.kind === 'EXERCISE') return [snapshot.exercise];
  return snapshot.personalExercises ?? [];
}

/** Ids des exercices SYSTEM référencés (les exercices personnels n’ont pas d’id). */
export function collectExerciseIdsFromSnapshot(snapshot: TrainingShareSnapshot): string[] {
  const ids = new Set<string>();
  for (const workout of workoutsOfSnapshot(snapshot)) {
    for (const exercise of workout.exercises) {
      if (exercise.exerciseId) ids.add(exercise.exerciseId);
    }
  }
  return [...ids];
}

export function collectEquipmentTypeIdsFromSnapshot(snapshot: TrainingShareSnapshot): string[] {
  const ids = new Set<string>();
  for (const workout of workoutsOfSnapshot(snapshot)) {
    for (const exercise of workout.exercises) {
      if (exercise.equipmentTypeId) ids.add(exercise.equipmentTypeId);
    }
  }
  return [...ids];
}
