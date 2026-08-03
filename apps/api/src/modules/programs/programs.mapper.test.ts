import { describe, expect, it } from 'vitest';

import {
  computeProgramPermissions,
  toProgramDetail,
  toProgramListItem,
} from './programs.mapper';

describe('programs.mapper', () => {
  it('computes permissions for an active program', () => {
    expect(computeProgramPermissions(null)).toEqual({
      canEdit: true,
      canArchive: true,
      canRestore: false,
    });
  });

  it('computes permissions for an archived program', () => {
    expect(
      computeProgramPermissions(new Date('2026-08-01T00:00:00.000Z')),
    ).toEqual({
      canEdit: false,
      canArchive: false,
      canRestore: true,
    });
  });

  it('maps detail without ownerUserId, sorted positions and exerciseCount 0', () => {
    const row = {
      id: 'p1',
      ownerUserId: 'u1',
      name: 'Force',
      description: null,
      goal: 'STRENGTH' as const,
      status: 'DRAFT' as const,
      archivedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      workoutTemplates: [
        {
          id: 't1',
          name: 'A',
          description: null,
          positionInProgram: 1,
          estimatedDurationMinutes: 45,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 't0',
          name: 'B',
          description: null,
          positionInProgram: 0,
          estimatedDurationMinutes: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    };

    const detail = toProgramDetail(row);
    expect(detail).not.toHaveProperty('ownerUserId');
    expect(detail.workoutTemplateCount).toBe(2);
    expect(detail.workoutTemplates.map((item) => item.id)).toEqual(['t0', 't1']);
    expect(detail.workoutTemplates.every((item) => item.exerciseCount === 0)).toBe(
      true,
    );
    expect(toProgramListItem(row).permissions.canEdit).toBe(true);
  });
});
