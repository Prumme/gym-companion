import { describe, expect, it } from 'vitest';

import type { WorkoutHistoryListItem } from '@gym-companion/shared';

import {
  formatHistoryDayHeading,
  getHistoryGroupLabel,
  groupWorkoutHistoryItems,
} from '../lib/workout-history-groups';

function item(
  overrides: Partial<WorkoutHistoryListItem> & Pick<WorkoutHistoryListItem, 'id' | 'localDate'>,
): WorkoutHistoryListItem {
  return {
    name: 'Séance',
    status: 'COMPLETED',
    timezone: 'Europe/Paris',
    startedAt: `${overrides.localDate}T08:00:00.000Z`,
    completedAt: `${overrides.localDate}T09:00:00.000Z`,
    cancelledAt: null,
    source: {
      programId: null,
      programName: null,
      workoutTemplateId: null,
      workoutTemplateName: null,
    },
    summary: {
      exerciseCount: 1,
      totalSetCount: 1,
      processedSetCount: 1,
      completedSetCount: 1,
      partialSetCount: 0,
      failedSetCount: 0,
      skippedSetCount: 0,
      pendingSetCount: 0,
    },
    ...overrides,
  };
}

describe('workout-history-groups', () => {
  it('labels today and yesterday', () => {
    expect(getHistoryGroupLabel('2026-08-11', '2026-08-11')).toBe('Aujourd’hui');
    expect(getHistoryGroupLabel('2026-08-10', '2026-08-11')).toBe('Hier');
    expect(getHistoryGroupLabel('2026-07-01', '2026-08-11')).toMatch(/juillet/i);
  });

  it('groups consecutive items without reordering', () => {
    const groups = groupWorkoutHistoryItems(
      [
        item({ id: '1', localDate: '2026-08-11' }),
        item({ id: '2', localDate: '2026-08-11', name: 'B' }),
        item({ id: '3', localDate: '2026-08-10' }),
        item({ id: '4', localDate: '2026-07-02' }),
      ],
      '2026-08-11',
    );
    expect(groups.map((g) => g.label)).toEqual([
      'Aujourd’hui',
      'Hier',
      expect.stringMatching(/juillet/i),
    ]);
    expect(groups[0]?.items).toHaveLength(2);
    expect(formatHistoryDayHeading('2026-08-03')).toMatch(/août/i);
  });
});
