import type {
  ExerciseMeasurementType,
  WorkoutSetType,
} from '@gym-companion/shared';

export type TemplateSetForSnapshot = {
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
};

export type TemplateExerciseForSnapshot = {
  id: string;
  position: number;
  restSecondsOverride: number | null;
  notes: string | null;
  exerciseId: string;
  exercise: {
    id: string;
    name: string;
    measurementType: ExerciseMeasurementType;
    archivedAt: Date | null;
    primaryMuscleGroup: { name: string };
  };
  equipmentType: {
    id: string;
    code: string;
    name: string;
  } | null;
  sets: TemplateSetForSnapshot[];
};

export type TemplateForSnapshot = {
  id: string;
  name: string;
  ownerUserId: string;
  programId: string;
  program: {
    id: string;
    name: string;
    ownerUserId: string;
    archivedAt: Date | null;
  };
  exercises: TemplateExerciseForSnapshot[];
};

export type SnapshotSetCreate = {
  sourceTemplateSetId: string;
  position: number;
  setType: WorkoutSetType;
  targetWeightKg: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetIntensityPercent: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  targetRestSeconds: number | null;
};

export type SnapshotExerciseCreate = {
  sourceExerciseId: string;
  sourceTemplateExerciseId: string;
  exerciseNameSnapshot: string;
  measurementTypeSnapshot: ExerciseMeasurementType;
  position: number;
  primaryMuscleGroupNameSnapshot: string;
  sourceExerciseArchivedAtCreation: boolean;
  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  equipmentCodeSnapshot: string | null;
  notesSnapshot: string | null;
  restSecondsSnapshot: number | null;
  sets: SnapshotSetCreate[];
};

export type WorkoutSessionSnapshotCreate = {
  sourceProgramId: string;
  sourceWorkoutTemplateId: string;
  programNameSnapshot: string;
  workoutTemplateNameSnapshot: string;
  name: string;
  exercises: SnapshotExerciseCreate[];
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

export type SnapshotValidationError =
  | { code: 'WORKOUT_TEMPLATE_EMPTY'; message: string }
  | { code: 'WORKOUT_TEMPLATE_EXERCISE_WITHOUT_SETS'; message: string };

/**
 * Transforme un modèle de séance chargé en données de snapshot immuables.
 * L’ordre des exercices et séries est préservé (positions compactes du modèle).
 */
export function buildWorkoutSessionSnapshotFromTemplate(
  template: TemplateForSnapshot,
):
  | { ok: true; snapshot: WorkoutSessionSnapshotCreate }
  | { ok: false; error: SnapshotValidationError } {
  const exercisesOrdered = [...template.exercises].sort(
    (a, b) => a.position - b.position,
  );

  if (exercisesOrdered.length === 0) {
    return {
      ok: false,
      error: {
        code: 'WORKOUT_TEMPLATE_EMPTY',
        message:
          'Impossible de démarrer une séance depuis un modèle sans exercice.',
      },
    };
  }

  const exercises: SnapshotExerciseCreate[] = [];

  for (const templateExercise of exercisesOrdered) {
    const setsOrdered = [...templateExercise.sets].sort(
      (a, b) => a.position - b.position,
    );

    if (setsOrdered.length === 0) {
      return {
        ok: false,
        error: {
          code: 'WORKOUT_TEMPLATE_EXERCISE_WITHOUT_SETS',
          message:
            'Impossible de démarrer une séance : un exercice du modèle n’a aucune série cible.',
        },
      };
    }

    exercises.push({
      sourceExerciseId: templateExercise.exercise.id,
      sourceTemplateExerciseId: templateExercise.id,
      exerciseNameSnapshot: templateExercise.exercise.name,
      measurementTypeSnapshot: templateExercise.exercise.measurementType,
      position: templateExercise.position,
      primaryMuscleGroupNameSnapshot:
        templateExercise.exercise.primaryMuscleGroup.name,
      sourceExerciseArchivedAtCreation:
        templateExercise.exercise.archivedAt !== null,
      equipmentTypeId: templateExercise.equipmentType?.id ?? null,
      equipmentNameSnapshot: templateExercise.equipmentType?.name ?? null,
      equipmentCodeSnapshot: templateExercise.equipmentType?.code ?? null,
      notesSnapshot: templateExercise.notes,
      restSecondsSnapshot: templateExercise.restSecondsOverride,
      sets: setsOrdered.map((set) => ({
        sourceTemplateSetId: set.id,
        position: set.position,
        setType: set.setType,
        targetWeightKg: decimalToNumber(set.targetWeightKg),
        targetRepMin: set.targetRepMin,
        targetRepMax: set.targetRepMax,
        targetDurationSeconds: set.targetDurationSeconds,
        targetDistanceMeters: decimalToNumber(set.targetDistanceMeters),
        targetIntensityPercent: decimalToNumber(set.targetIntensityPercent),
        targetRir: set.targetRir,
        targetRpe: decimalToNumber(set.targetRpe),
        targetRestSeconds: set.restSeconds,
      })),
    });
  }

  return {
    ok: true,
    snapshot: {
      sourceProgramId: template.program.id,
      sourceWorkoutTemplateId: template.id,
      programNameSnapshot: template.program.name,
      workoutTemplateNameSnapshot: template.name,
      name: template.name,
      exercises,
    },
  };
}
