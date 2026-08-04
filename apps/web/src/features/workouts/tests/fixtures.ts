import type {
  WorkoutSessionDetail,
  WorkoutSessionSetDetail,
} from '@gym-companion/shared';

const now = '2026-08-04T10:00:00.000Z';

export function createWorkoutSet(
  overrides: Partial<WorkoutSessionSetDetail> = {},
): WorkoutSessionSetDetail {
  return {
    id: 'ws-1',
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
    ...overrides,
  };
}

export function createWorkoutSessionDetail(
  overrides: Partial<WorkoutSessionDetail> = {},
): WorkoutSessionDetail {
  return {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Séance Push',
    status: 'ACTIVE',
    localDate: '2026-08-04',
    timezone: 'Europe/Paris',
    startedAt: now,
    pausedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    notes: null,
    version: 1,
    source: {
      programId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      programName: 'Push Pull Legs',
      workoutTemplateId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      workoutTemplateName: 'Push A',
    },
    exercises: [
      {
        id: 'wse-1',
        position: 0,
        sourceExerciseId: 'ex-1',
        exerciseName: 'Développé couché',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Pectoraux',
        sourceExerciseArchivedAtCreation: false,
        equipment: {
          id: 'eq-1',
          code: 'barbell',
          name: 'Barre',
        },
        notes: 'Contrôle',
        restSeconds: 90,
        sets: [createWorkoutSet()],
      },
    ],
    permissions: {
      canPause: true,
      canResume: false,
      canComplete: true,
      canCancel: true,
      canRecordSets: true,
    },
    ...overrides,
  };
}
