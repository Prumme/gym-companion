import { describe, expect, it } from 'vitest';

import { buildWorkoutSessionSnapshotFromTemplate } from './workout-snapshot';
import {
  computeActiveWorkoutPermissions,
  toWorkoutSessionDetail,
  type WorkoutSessionSnapshotRow,
} from './workouts.mapper';

function makeTemplate(overrides?: {
  exercises?: ReturnType<typeof makeExercise>[];
  programName?: string;
  templateName?: string;
  archivedProgram?: boolean;
}) {
  return {
    id: 'tmpl-1',
    name: overrides?.templateName ?? 'Push Day',
    ownerUserId: 'user-1',
    programId: 'prog-1',
    program: {
      id: 'prog-1',
      name: overrides?.programName ?? 'Hypertrophie',
      ownerUserId: 'user-1',
      archivedAt: overrides?.archivedProgram ? new Date() : null,
    },
    exercises: overrides?.exercises ?? [makeExercise()],
  };
}

function makeExercise(overrides?: {
  position?: number;
  name?: string;
  archived?: boolean;
  sets?: Array<{
    id: string;
    position: number;
    setType: 'WORKING' | 'WARMUP';
    targetRepMin: number | null;
    targetRepMax: number | null;
    restSeconds: number | null;
  }>;
  notes?: string | null;
  restSecondsOverride?: number | null;
}) {
  return {
    id: `te-${overrides?.position ?? 0}`,
    position: overrides?.position ?? 0,
    restSecondsOverride: overrides?.restSecondsOverride ?? 90,
    notes: overrides?.notes ?? 'Contrôler la descente',
    exerciseId: `ex-${overrides?.position ?? 0}`,
    exercise: {
      id: `ex-${overrides?.position ?? 0}`,
      name: overrides?.name ?? 'Développé couché',
      measurementType: 'WEIGHT_REPS' as const,
      archivedAt: overrides?.archived ? new Date('2026-01-01') : null,
      primaryMuscleGroup: { name: 'Pectoraux' },
    },
    equipmentType: {
      id: 'eq-1',
      code: 'BARBELL',
      name: 'Barre',
    },
    sets: (overrides?.sets ?? [
      {
        id: 'set-1',
        position: 0,
        setType: 'WORKING' as const,
        targetRepMin: 8,
        targetRepMax: 10,
        restSeconds: 120,
      },
    ]).map((set) => ({
      ...set,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      targetWeightKg: 60,
      targetIntensityPercent: null,
      targetRir: 2,
      targetRpe: null,
    })),
  };
}

describe('buildWorkoutSessionSnapshotFromTemplate', () => {
  it('copie noms, ordre, mesure, équipement, repos, notes et cibles', () => {
    const result = buildWorkoutSessionSnapshotFromTemplate(
      makeTemplate({
        exercises: [
          makeExercise({ position: 0, name: 'A' }),
          makeExercise({
            position: 1,
            name: 'B',
            notes: 'Note B',
            restSecondsOverride: 45,
            sets: [
              {
                id: 's0',
                position: 0,
                setType: 'WARMUP',
                targetRepMin: 12,
                targetRepMax: 12,
                restSeconds: 60,
              },
              {
                id: 's1',
                position: 1,
                setType: 'WORKING',
                targetRepMin: 8,
                targetRepMax: 10,
                restSeconds: 150,
              },
            ],
          }),
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.snapshot.name).toBe('Push Day');
    expect(result.snapshot.programNameSnapshot).toBe('Hypertrophie');
    expect(result.snapshot.workoutTemplateNameSnapshot).toBe('Push Day');
    expect(result.snapshot.exercises).toHaveLength(2);
    expect(result.snapshot.exercises.map((e) => e.exerciseNameSnapshot)).toEqual([
      'A',
      'B',
    ]);
    expect(result.snapshot.exercises[1]?.notesSnapshot).toBe('Note B');
    expect(result.snapshot.exercises[1]?.restSecondsSnapshot).toBe(45);
    expect(result.snapshot.exercises[0]?.equipmentNameSnapshot).toBe('Barre');
    expect(result.snapshot.exercises[0]?.measurementTypeSnapshot).toBe(
      'WEIGHT_REPS',
    );
    expect(result.snapshot.exercises[1]?.sets.map((s) => s.position)).toEqual([
      0, 1,
    ]);
    expect(result.snapshot.exercises[1]?.sets[1]?.targetRepMin).toBe(8);
    expect(result.snapshot.exercises[1]?.sets[1]?.targetRestSeconds).toBe(150);
    expect(result.snapshot.exercises[0]?.sets[0]?.targetWeightKg).toBe(60);
    expect(result.snapshot.exercises[0]?.sets[0]?.targetRir).toBe(2);
  });

  it('conserve le flag archivé sans bloquer', () => {
    const result = buildWorkoutSessionSnapshotFromTemplate(
      makeTemplate({ exercises: [makeExercise({ archived: true })] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.snapshot.exercises[0]?.sourceExerciseArchivedAtCreation).toBe(
      true,
    );
  });

  it('refuse un modèle vide', () => {
    const result = buildWorkoutSessionSnapshotFromTemplate(
      makeTemplate({ exercises: [] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('WORKOUT_TEMPLATE_EMPTY');
  });

  it('refuse un exercice sans série', () => {
    const exercise = makeExercise();
    exercise.sets = [];
    const result = buildWorkoutSessionSnapshotFromTemplate(
      makeTemplate({ exercises: [exercise] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('WORKOUT_TEMPLATE_EXERCISE_WITHOUT_SETS');
  });
});

describe('workouts.mapper', () => {
  const row: WorkoutSessionSnapshotRow = {
    id: 'ws-1',
    name: 'Push Day',
    status: 'ACTIVE',
    localDate: new Date(Date.UTC(2026, 7, 4)),
    timezone: 'Europe/Paris',
    startedAt: new Date('2026-08-04T10:00:00.000Z'),
    pausedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    notes: null,
    version: 1,
    sourceProgramId: 'prog-1',
    sourceWorkoutTemplateId: 'tmpl-1',
    programNameSnapshot: 'Hypertrophie',
    workoutTemplateNameSnapshot: 'Push Day',
    exercises: [
      {
        id: 'wse-1',
        position: 0,
        sourceExerciseId: 'ex-1',
        exerciseNameSnapshot: 'Développé couché',
        measurementTypeSnapshot: 'WEIGHT_REPS',
        primaryMuscleGroupNameSnapshot: 'Pectoraux',
        sourceExerciseArchivedAtCreation: false,
        equipmentTypeId: 'eq-1',
        equipmentNameSnapshot: 'Barre',
        equipmentCodeSnapshot: 'BARBELL',
        notesSnapshot: 'Notes',
        restSecondsSnapshot: 90,
        sets: [
          {
            id: 'ws-set-1',
            position: 0,
            setType: 'WORKING',
            status: 'PENDING',
            targetWeightKg: 60,
            targetRepMin: 8,
            targetRepMax: 10,
            targetDurationSeconds: null,
            targetDistanceMeters: null,
            targetIntensityPercent: null,
            targetRir: 2,
            targetRpe: null,
            targetRestSeconds: 120,
            actualWeightKg: null,
            actualReps: null,
            actualDurationSeconds: null,
            actualDistanceMeters: null,
            actualRir: null,
            actualRpe: null,
            reachedFailure: false,
            notes: null,
            startedAt: null,
            completedAt: null,
          },
        ],
      },
    ],
  };

  it('mappe le détail depuis le snapshot sans champs Prisma internes', () => {
    const detail = toWorkoutSessionDetail(row);
    expect(detail.localDate).toBe('2026-08-04');
    expect(detail.source.programName).toBe('Hypertrophie');
    expect(detail.exercises[0]?.exerciseName).toBe('Développé couché');
    expect(detail.exercises[0]?.equipment.name).toBe('Barre');
    expect(detail.exercises[0]?.sets[0]?.targetWeightKg).toBe(60);
    expect(detail.metrics).toBeNull();
    expect(detail).not.toHaveProperty('ownerUserId');
    expect(detail.exercises[0]).not.toHaveProperty('exerciseNameSnapshot');
  });

  it('calcule les permissions d’une séance ACTIVE', () => {
    expect(computeActiveWorkoutPermissions('ACTIVE')).toEqual({
      canPause: true,
      canResume: false,
      canComplete: true,
      canCancel: true,
      canRecordSets: true,
    });
  });

  it('désactive la saisie des séries en pause', () => {
    expect(computeActiveWorkoutPermissions('PAUSED')).toEqual({
      canPause: false,
      canResume: true,
      canComplete: true,
      canCancel: true,
      canRecordSets: false,
    });
  });

  it('verrouille une séance terminée', () => {
    expect(computeActiveWorkoutPermissions('COMPLETED')).toEqual({
      canPause: false,
      canResume: false,
      canComplete: false,
      canCancel: false,
      canRecordSets: false,
    });
  });
});
