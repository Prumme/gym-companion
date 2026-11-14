import { describe, expect, it } from 'vitest';

import {
  computeExercisePermissions,
  DEFAULT_EXERCISE_USER_PREFERENCE,
  toExerciseListItem,
  toExerciseUserPreference,
  type ExerciseListRow,
} from './exercises.mapper';

describe('computeExercisePermissions', () => {
  const userId = 'user-1';

  it('denies edits on system exercises', () => {
    expect(computeExercisePermissions('SYSTEM', null, userId, null)).toEqual({
      canEdit: false,
      canArchive: false,
      canRestore: false,
    });
  });

  it('allows edit/archive for owned active exercises', () => {
    expect(computeExercisePermissions('USER', null, userId, userId)).toEqual({
      canEdit: true,
      canArchive: true,
      canRestore: false,
    });
  });

  it('allows restore for owned archived exercises', () => {
    expect(
      computeExercisePermissions('USER', new Date('2026-01-01'), userId, userId),
    ).toEqual({
      canEdit: false,
      canArchive: false,
      canRestore: true,
    });
  });

  it('denies permissions for another user ownership', () => {
    expect(computeExercisePermissions('USER', null, userId, 'other')).toEqual({
      canEdit: false,
      canArchive: false,
      canRestore: false,
    });
  });
});

describe('toExerciseUserPreference', () => {
  it('maps default values when preference is missing', () => {
    expect(toExerciseUserPreference(null)).toEqual(DEFAULT_EXERCISE_USER_PREFERENCE);
    expect(toExerciseUserPreference(undefined)).toEqual(DEFAULT_EXERCISE_USER_PREFERENCE);
  });

  it('maps an existing preference row', () => {
    expect(
      toExerciseUserPreference({
        isFavorite: true,
        isExcludedFromSuggestions: true,
        restSecondsOverride: 90,
        preferredEquipmentType: {
          id: 'eq-1',
          code: 'dumbbell',
          name: 'Haltères',
        },
      }),
    ).toEqual({
      isFavorite: true,
      isExcludedFromSuggestions: true,
      restSecondsOverride: 90,
      preferredEquipmentType: {
        id: 'eq-1',
        code: 'dumbbell',
        name: 'Haltères',
      },
    });
  });
});

describe('exercise media mapping', () => {
  const baseRow: ExerciseListRow = {
    id: 'exercise-1',
    source: 'SYSTEM',
    slug: 'squat-barre',
    name: 'Squat barre',
    measurementType: 'WEIGHT_REPS',
    category: 'STRENGTH',
    cardioType: null,
    defaultRestSeconds: 120,
    archivedAt: null,
    ownerUserId: null,
    primaryMuscleGroup: { id: 'm', code: 'quads', name: 'Quadriceps', parentId: null },
    defaultEquipmentType: null,
    userPreferences: [],
  };

  it('exposes the demonstration of a mapped system exercise', () => {
    expect(toExerciseListItem(baseRow, 'user-1').media?.frames).toEqual([
      '/exercise-media/barbell-squat/0.webp',
      '/exercise-media/barbell-squat/1.webp',
    ]);
  });

  it('never exposes a demonstration for a user exercise', () => {
    expect(
      toExerciseListItem({ ...baseRow, source: 'USER', ownerUserId: 'user-1' }, 'user-1').media,
    ).toBeNull();
  });
});
