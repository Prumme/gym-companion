import type { InfiniteData } from '@tanstack/react-query';
import type { ExerciseDetail, ExerciseListResponse } from '@gym-companion/shared';
import { describe, expect, it } from 'vitest';

import {
  detailToListItem,
  mergeDetailIntoListItem,
  removeExerciseFromInfiniteData,
  updateExerciseInInfiniteData,
} from '../lib/exercise-cache';
import { createExerciseListItem } from './fixtures';

function infinite(
  items: ReturnType<typeof createExerciseListItem>[],
): InfiniteData<ExerciseListResponse, string | undefined> {
  return {
    pages: [
      {
        data: items,
        pagination: { hasMore: false, nextCursor: null },
      },
    ],
    pageParams: [undefined],
  };
}

describe('exercise-cache CRUD helpers', () => {
  it('removes an exercise from non-archived lists without duplication', () => {
    const a = createExerciseListItem({ id: 'a' });
    const b = createExerciseListItem({ id: 'b', name: 'Autre' });
    const data = infinite([a, b, a]);
    const next = removeExerciseFromInfiniteData(data, 'a');
    expect(next.pages[0]?.data.map((item) => item.id)).toEqual(['b']);
  });

  it('updates archived detail fields in includeArchived lists', () => {
    const item = createExerciseListItem({
      id: 'user-1',
      source: 'USER',
      archivedAt: null,
      permissions: { canEdit: true, canArchive: true, canRestore: false },
      userPreference: {
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentType: null,
        restSecondsOverride: 45,
      },
    });
    const detail = {
      ...item,
      secondaryMuscleGroups: [],
      compatibleEquipmentTypes: [],
      instructions: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      archivedAt: '2026-01-02T00:00:00.000Z',
      permissions: { canEdit: false, canArchive: false, canRestore: true },
    } satisfies ExerciseDetail;

    const next = updateExerciseInInfiniteData(infinite([item]), 'user-1', (current) =>
      mergeDetailIntoListItem(current, detail),
    );

    const updated = next.pages[0]?.data[0];
    expect(updated?.archivedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(updated?.permissions.canRestore).toBe(true);
    expect(updated?.userPreference.isFavorite).toBe(true);
    expect(updated?.userPreference.restSecondsOverride).toBe(45);
  });

  it('maps detail to list item', () => {
    const detail = {
      ...createExerciseListItem({ id: 'x', source: 'USER' }),
      secondaryMuscleGroups: [],
      compatibleEquipmentTypes: [],
      instructions: 'ok',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies ExerciseDetail;
    expect(detailToListItem(detail).id).toBe('x');
    expect(detailToListItem(detail).source).toBe('USER');
  });
});
