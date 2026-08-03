import { describe, expect, it } from 'vitest';

import {
  computeExercisePermissions,
  DEFAULT_EXERCISE_USER_PREFERENCE,
  toExerciseUserPreference,
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
