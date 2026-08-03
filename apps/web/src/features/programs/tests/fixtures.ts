import type {
  ProgramDetail,
  ProgramListItem,
  WorkoutTemplateDetail,
  WorkoutTemplateExerciseDetail,
  WorkoutTemplateSetTarget,
} from '@gym-companion/shared';

const now = '2026-08-03T12:00:00.000Z';

export function createProgramListItem(
  overrides: Partial<ProgramListItem> = {},
): ProgramListItem {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Push Pull Legs',
    description: 'Programme 6 jours',
    goal: 'HYPERTROPHY',
    status: 'ACTIVE',
    workoutTemplateCount: 2,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    permissions: {
      canEdit: true,
      canArchive: true,
      canRestore: false,
    },
    ...overrides,
  };
}

export function createSet(
  overrides: Partial<WorkoutTemplateSetTarget> = {},
): WorkoutTemplateSetTarget {
  return {
    id: 'set-1',
    position: 0,
    setType: 'WORKING',
    targetRepMin: 8,
    targetRepMax: 10,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    targetWeightKg: null,
    targetIntensityPercent: null,
    targetRir: 2,
    targetRpe: null,
    restSeconds: 120,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTemplateExercise(
  overrides: Partial<WorkoutTemplateExerciseDetail> = {},
): WorkoutTemplateExerciseDetail {
  return {
    id: 'tex-1',
    position: 0,
    exercise: {
      id: 'ex-1',
      source: 'SYSTEM',
      name: 'Développé couché',
      measurementType: 'WEIGHT_REPS',
      primaryMuscleGroup: {
        id: 'mg-1',
        code: 'chest',
        name: 'Pectoraux',
        parentId: null,
      },
      defaultEquipmentType: {
        id: 'eq-1',
        code: 'barbell',
        name: 'Barre',
      },
      archivedAt: null,
    },
    equipmentType: {
      id: 'eq-1',
      code: 'barbell',
      name: 'Barre',
    },
    restSecondsOverride: 90,
    notes: null,
    sets: [createSet()],
    permissions: {
      canEdit: true,
      canDelete: true,
      canReorder: true,
    },
    ...overrides,
  };
}

export function createTemplate(
  overrides: Partial<WorkoutTemplateDetail> = {},
): WorkoutTemplateDetail {
  const exercises = overrides.exercises ?? [createTemplateExercise()];
  return {
    id: 'wt-1',
    name: 'Push A',
    description: 'Pectoraux / épaules',
    position: 0,
    estimatedDurationMinutes: 60,
    exerciseCount: exercises.length,
    createdAt: now,
    updatedAt: now,
    exercises,
    ...overrides,
  };
}

export function createProgramDetail(
  overrides: Partial<ProgramDetail> = {},
): ProgramDetail {
  const templates = overrides.workoutTemplates ?? [createTemplate()];
  return {
    ...createProgramListItem({
      workoutTemplateCount: templates.length,
    }),
    workoutTemplates: templates,
    ...overrides,
  };
}
