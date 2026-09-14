import type { WorkoutSessionDetail } from '@gym-companion/shared';

export const WORKOUT_EXPORT_SCHEMA_VERSION = 1 as const;

export type WorkoutExportSet = {
  position: number;
  setType: string;
  status: string;
  targetWeightKg: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  targetRestSeconds: number | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualRir: number | null;
  actualRpe: number | null;
  reachedFailure: boolean;
  notes: string | null;
};

export type WorkoutExportExercise = {
  position: number;
  name: string;
  measurementType: string;
  primaryMuscleGroupName: string | null;
  equipment: { code: string | null; name: string | null };
  notes: string | null;
  sets: WorkoutExportSet[];
};

export type WorkoutExportSession = {
  name: string;
  status: string;
  localDate: string;
  timezone: string;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  source: {
    programName: string | null;
    workoutTemplateName: string | null;
  };
  exercises: WorkoutExportExercise[];
};

export type WorkoutExportDocument = {
  schemaVersion: typeof WORKOUT_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  workouts: WorkoutExportSession[];
};

export function toWorkoutExportSession(
  session: WorkoutSessionDetail,
): WorkoutExportSession {
  return {
    name: session.name,
    status: session.status,
    localDate: session.localDate,
    timezone: session.timezone,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    cancelledAt: session.cancelledAt,
    notes: session.notes,
    source: {
      programName: session.source.programName,
      workoutTemplateName: session.source.workoutTemplateName,
    },
    exercises: session.exercises.map((exercise) => ({
      position: exercise.position,
      name: exercise.exerciseName,
      measurementType: exercise.measurementType,
      primaryMuscleGroupName: exercise.primaryMuscleGroupName,
      equipment: {
        code: exercise.equipment.code,
        name: exercise.equipment.name,
      },
      notes: exercise.notes,
      sets: exercise.sets.map((set) => ({
        position: set.position,
        setType: set.setType,
        status: set.status,
        targetWeightKg: set.targetWeightKg,
        targetRepMin: set.targetRepMin,
        targetRepMax: set.targetRepMax,
        targetDurationSeconds: set.targetDurationSeconds,
        targetDistanceMeters: set.targetDistanceMeters,
        targetRir: set.targetRir,
        targetRpe: set.targetRpe,
        targetRestSeconds: set.targetRestSeconds,
        actualWeightKg: set.actualWeightKg,
        actualReps: set.actualReps,
        actualDurationSeconds: set.actualDurationSeconds,
        actualDistanceMeters: set.actualDistanceMeters,
        actualRir: set.actualRir,
        actualRpe: set.actualRpe,
        reachedFailure: set.reachedFailure,
        notes: set.notes,
      })),
    })),
  };
}

export function buildWorkoutExportDocument(
  sessions: WorkoutSessionDetail[],
  exportedAt = new Date().toISOString(),
): WorkoutExportDocument {
  return {
    schemaVersion: WORKOUT_EXPORT_SCHEMA_VERSION,
    exportedAt,
    workouts: sessions.map(toWorkoutExportSession),
  };
}

export function workoutExportFilename(sessions: WorkoutSessionDetail[]): string {
  if (sessions.length === 1) {
    const session = sessions[0]!;
    return `gym-companion-seance-${session.localDate}.json`;
  }
  return `gym-companion-seances-${sessions.length}.json`;
}

export function downloadJsonFile(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyJsonText(value: unknown): Promise<boolean> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
