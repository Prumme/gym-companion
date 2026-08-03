import { describe, expect, it } from 'vitest';

import { computeExercisePermissions } from './exercises.mapper';

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
