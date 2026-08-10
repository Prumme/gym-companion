import { describe, expect, it, vi } from 'vitest';

import { coachingQueryKeys } from '@/features/coaching/api/coaching-query-keys';
import { personalRecordQueryKeys } from '@/features/personal-records/api/personal-record-query-keys';
import { progressQueryKeys } from '@/features/progress/api/progress-query-keys';
import { applyLifecycleToCacheForTest } from '@/features/workouts/hooks/use-workout-mutations';
import { createWorkoutSessionDetail } from '@/features/workouts/tests/fixtures';
import type { QueryClient } from '@tanstack/react-query';

describe('coaching invalidation (5.1)', () => {
  it('invalide coaching uniquement après COMPLETE serveur', () => {
    const invalidateQueries = vi.fn();
    const queryClient = {
      setQueryData: vi.fn(),
      invalidateQueries,
    } as unknown as QueryClient;

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({ status: 'ACTIVE' }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: coachingQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({
        status: 'CANCELLED',
        cancelledAt: '2026-08-01T09:00:00.000Z',
      }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: coachingQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({
        status: 'COMPLETED',
        completedAt: '2026-08-01T09:00:00.000Z',
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: coachingQueryKeys.all }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: progressQueryKeys.all }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );
  });

  it('ne mélange pas coaching et progress dans les query keys', () => {
    expect(coachingQueryKeys.all).toEqual(['coaching']);
    expect(coachingQueryKeys.loadRecommendation('wte-1')).toEqual([
      'coaching',
      'load-recommendation',
      'wte-1',
    ]);
    expect(progressQueryKeys.all[0]).not.toBe('coaching');
    expect(coachingQueryKeys.loadRecommendationDecisions('wte-1')).toEqual([
      'coaching',
      'load-recommendation-decisions',
      'wte-1',
    ]);
    expect(coachingQueryKeys.plateauAnalysis('ex-1')).toEqual([
      'coaching',
      'plateau-analysis',
      'ex-1',
      null,
    ]);
  });
});
