import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXERCISE_USER_PREFERENCE,
  hasCustomExercisePreference,
  preferenceFormToPayload,
  preferenceToFormValues,
  preferenceToUpdateInput,
} from '../lib/exercise-preference';
import {
  applyPreferenceToDetail,
  applyPreferenceToListItem,
  removeExerciseFromInfiniteData,
  updateExerciseInInfiniteData,
  type ExerciseInfiniteData,
} from '../lib/exercise-cache';
import { createExerciseListItem } from './fixtures';

describe('hasCustomExercisePreference', () => {
  it('returns false for defaults', () => {
    expect(hasCustomExercisePreference(DEFAULT_EXERCISE_USER_PREFERENCE)).toBe(false);
  });

  it('detects favorite only', () => {
    expect(
      hasCustomExercisePreference({
        ...DEFAULT_EXERCISE_USER_PREFERENCE,
        isFavorite: true,
      }),
    ).toBe(true);
  });

  it('detects exclusion only', () => {
    expect(
      hasCustomExercisePreference({
        ...DEFAULT_EXERCISE_USER_PREFERENCE,
        isExcludedFromSuggestions: true,
      }),
    ).toBe(true);
  });

  it('detects preferred equipment only', () => {
    expect(
      hasCustomExercisePreference({
        ...DEFAULT_EXERCISE_USER_PREFERENCE,
        preferredEquipmentType: {
          id: 'eq-1',
          code: 'dumbbell',
          name: 'Haltères',
        },
      }),
    ).toBe(true);
  });

  it('detects rest override only', () => {
    expect(
      hasCustomExercisePreference({
        ...DEFAULT_EXERCISE_USER_PREFERENCE,
        restSecondsOverride: 90,
      }),
    ).toBe(true);
  });
});

describe('preferenceFormToPayload', () => {
  it('maps empty rest to null', () => {
    expect(
      preferenceFormToPayload({
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: '',
        restSecondsOverride: '   ',
      }),
    ).toEqual({
      isFavorite: true,
      isExcludedFromSuggestions: false,
      preferredEquipmentTypeId: null,
      restSecondsOverride: null,
    });
  });

  it('parses numeric rest and equipment id', () => {
    expect(
      preferenceFormToPayload({
        isFavorite: false,
        isExcludedFromSuggestions: true,
        preferredEquipmentTypeId: '33333333-3333-3333-3333-333333333333',
        restSecondsOverride: '90',
      }),
    ).toEqual({
      isFavorite: false,
      isExcludedFromSuggestions: true,
      preferredEquipmentTypeId: '33333333-3333-3333-3333-333333333333',
      restSecondsOverride: 90,
    });
  });

  it('round-trips form values', () => {
    const preference = {
      isFavorite: true,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: {
        id: '33333333-3333-3333-3333-333333333333',
        code: 'barbell',
        name: 'Barre',
      },
      restSecondsOverride: 120,
    };
    expect(preferenceFormToPayload(preferenceToFormValues(preference))).toEqual(
      preferenceToUpdateInput(preference),
    );
  });
});

describe('exercise cache helpers', () => {
  const pageData: ExerciseInfiniteData = {
    pages: [
      {
        data: [
          createExerciseListItem({ id: '1', name: 'A' }),
          createExerciseListItem({ id: '2', name: 'B' }),
        ],
        pagination: { hasMore: false, nextCursor: null },
      },
    ],
    pageParams: [undefined],
  };

  it('updates an exercise preference in infinite pages', () => {
    const next = updateExerciseInInfiniteData(pageData, '2', (item) =>
      applyPreferenceToListItem(item, {
        ...item.userPreference,
        isFavorite: true,
      }),
    );
    expect(next.pages[0]?.data[1]?.userPreference.isFavorite).toBe(true);
    expect(next.pages[0]?.data[0]?.userPreference.isFavorite).toBe(false);
  });

  it('removes an exercise from favoriteOnly lists', () => {
    const next = removeExerciseFromInfiniteData(pageData, '1');
    expect(next.pages[0]?.data.map((item) => item.id)).toEqual(['2']);
  });

  it('updates detail preference without mutating other fields', () => {
    const detail = {
      ...createExerciseListItem(),
      secondaryMuscleGroups: [],
      compatibleEquipmentTypes: [],
      instructions: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const updated = applyPreferenceToDetail(detail, {
      ...DEFAULT_EXERCISE_USER_PREFERENCE,
      isFavorite: true,
      restSecondsOverride: 45,
    });
    expect(updated.userPreference.isFavorite).toBe(true);
    expect(updated.instructions).toBe('x');
    expect(detail.userPreference.isFavorite).toBe(false);
  });
});
