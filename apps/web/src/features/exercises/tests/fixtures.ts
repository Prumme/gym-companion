import type { ExerciseListItem } from '@gym-companion/shared';

export function createExerciseListItem(
  overrides: Partial<ExerciseListItem> = {},
): ExerciseListItem {
  return {
    id: 'exercise-1',
    source: 'SYSTEM',
    name: 'Développé couché à la barre',
    measurementType: 'WEIGHT_REPS',
    primaryMuscleGroup: {
      id: 'muscle-chest',
      code: 'chest',
      name: 'Pectoraux',
      parentId: null,
    },
    defaultEquipmentType: {
      id: 'eq-barbell',
      code: 'barbell',
      name: 'Barre',
    },
    defaultRestSeconds: 120,
    archivedAt: null,
    permissions: {
      canEdit: false,
      canArchive: false,
      canRestore: false,
    },
    userPreference: {
      isFavorite: false,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: null,
      restSecondsOverride: null,
    },
    ...overrides,
  };
}
