import { createHash, randomBytes } from 'node:crypto';

import type {
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

type ExerciseRow = {
  exerciseId: string;
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

export function serializeExerciseForShare(
  exercise: ExerciseRow,
): SharedTemplateExercise {
  return {
    exerciseId: exercise.exerciseId,
    equipmentTypeId: exercise.equipmentTypeId,
    notes: exercise.notes,
    restSecondsOverride: exercise.restSecondsOverride,
    sets: exercise.sets.map(serializeSetForShare),
  };
}

export function serializeWorkoutTemplateBodyForShare(
  template: TemplateRow,
): SharedWorkoutTemplateBody {
  return {
    name: template.name.trim(),
    description: template.description,
    estimatedDurationMinutes: template.estimatedDurationMinutes,
    exercises: template.exercises.map(serializeExerciseForShare),
  };
}

export function serializeWorkoutTemplateForShare(
  template: TemplateRow,
): SharedWorkoutTemplateSnapshotV1 {
  const body = serializeWorkoutTemplateBodyForShare(template);
  return {
    version: 1,
    kind: 'WORKOUT_TEMPLATE',
    ...body,
  };
}

export function serializeProgramForShare(input: {
  name: string;
  description: string | null;
  goal: SharedProgramSnapshotV1['goal'];
  workouts: TemplateRow[];
}): SharedProgramSnapshotV1 {
  return {
    version: 1,
    kind: 'PROGRAM',
    name: input.name.trim(),
    description: input.description,
    goal: input.goal,
    workouts: input.workouts.map(serializeWorkoutTemplateBodyForShare),
  };
}

export function parseTrainingShareSnapshot(
  raw: unknown,
): TrainingShareSnapshot {
  return trainingShareSnapshotSchema.parse(raw);
}

export function collectExerciseIdsFromSnapshot(
  snapshot: TrainingShareSnapshot,
): string[] {
  const workouts =
    snapshot.kind === 'PROGRAM' ? snapshot.workouts : [snapshot];
  const ids = new Set<string>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      ids.add(exercise.exerciseId);
    }
  }
  return [...ids];
}

export function collectEquipmentTypeIdsFromSnapshot(
  snapshot: TrainingShareSnapshot,
): string[] {
  const workouts =
    snapshot.kind === 'PROGRAM' ? snapshot.workouts : [snapshot];
  const ids = new Set<string>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (exercise.equipmentTypeId) ids.add(exercise.equipmentTypeId);
    }
  }
  return [...ids];
}
