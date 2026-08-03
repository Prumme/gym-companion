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

  it('maps detail with nested exercises/sets and exerciseCount', () => {
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
          id: 't0',
          name: 'A',
          description: null,
          positionInProgram: 0,
          estimatedDurationMinutes: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          exercises: [
            {
              id: 'te1',
              position: 0,
              restSecondsOverride: 90,
              notes: null,
              exercise: {
                id: 'ex1',
                source: 'SYSTEM' as const,
                name: 'Squat',
                measurementType: 'WEIGHT_REPS' as const,
                archivedAt: null,
                primaryMuscleGroup: {
                  id: 'm1',
                  code: 'quads',
                  name: 'Quadriceps',
                  parentId: null,
                },
                defaultEquipmentType: {
                  id: 'eq1',
                  code: 'barbell',
                  name: 'Barre',
                },
              },
              equipmentType: null,
              sets: [
                {
                  id: 's1',
                  position: 0,
                  setType: 'WORKING' as const,
                  targetRepMin: 5,
                  targetRepMax: 5,
                  targetDurationSeconds: null,
                  targetDistanceMeters: null,
                  targetWeightKg: 100,
                  targetIntensityPercent: null,
                  targetRir: 2,
                  targetRpe: null,
                  restSeconds: 120,
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
        },
      ],
    };

    const detail = toProgramDetail(row);
    expect(detail).not.toHaveProperty('ownerUserId');
    expect(detail.workoutTemplates[0]?.exerciseCount).toBe(1);
    expect(detail.workoutTemplates[0]?.exercises[0]?.exercise.name).toBe('Squat');
    expect(detail.workoutTemplates[0]?.exercises[0]?.sets[0]?.targetWeightKg).toBe(
      100,
    );
    expect(detail.workoutTemplates[0]?.exercises[0]?.permissions.canEdit).toBe(
      true,
    );
    expect(toProgramListItem(row).permissions.canEdit).toBe(true);
  });
});
