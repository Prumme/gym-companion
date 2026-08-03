import { describe, expect, it } from 'vitest';

import {
  countActiveExerciseFilters,
  parseExerciseListSearchParams,
  serializeExerciseListSearchParams,
} from '../lib/exercise-list-url';

describe('exercise list URL sync', () => {
  it('parses query parameters', () => {
    const params = new URLSearchParams(
      'search=developpe&muscleGroupId=m1&source=SYSTEM&favoriteOnly=true&includeArchived=false',
    );
    expect(parseExerciseListSearchParams(params)).toEqual({
      search: 'developpe',
      muscleGroupId: 'm1',
      equipmentTypeId: undefined,
      measurementType: undefined,
      source: 'SYSTEM',
      favoriteOnly: true,
      includeArchived: undefined,
    });
  });

  it('parses booleans strictly and ignores invalid enums', () => {
    const params = new URLSearchParams(
      'favoriteOnly=maybe&measurementType=NOT_REAL&source=COMMUNITY',
    );
    expect(parseExerciseListSearchParams(params)).toEqual({
      search: undefined,
      muscleGroupId: undefined,
      equipmentTypeId: undefined,
      measurementType: undefined,
      source: undefined,
      favoriteOnly: undefined,
      includeArchived: undefined,
    });
  });

  it('serializes filters and omits default values', () => {
    const params = serializeExerciseListSearchParams({
      search: '  squat  ',
      muscleGroupId: 'm1',
      favoriteOnly: true,
      includeArchived: false,
      source: undefined,
    });
    expect(params.toString()).toBe('search=squat&muscleGroupId=m1&favoriteOnly=true');
  });

  it('counts active filters', () => {
    expect(
      countActiveExerciseFilters({
        search: 'x',
        favoriteOnly: true,
        source: 'USER',
      }),
    ).toBe(3);
    expect(countActiveExerciseFilters({})).toBe(0);
  });
});
