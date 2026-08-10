import { describe, expect, it, vi } from 'vitest';

import { personalRecordQueryKeys } from '@/features/personal-records/api/personal-record-query-keys';
import { progressQueryKeys } from '@/features/progress/api/progress-query-keys';
import { applyLifecycleToCacheForTest } from '@/features/workouts/hooks/use-workout-mutations';
import { createWorkoutSessionDetail } from '@/features/workouts/tests/fixtures';
import type { QueryClient } from '@tanstack/react-query';

describe('progress invalidation (4.3)', () => {
  it('invalide la progression uniquement après COMPLETE serveur', () => {
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
      expect.objectContaining({ queryKey: progressQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({ status: 'PAUSED' }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: progressQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({
        status: 'CANCELLED',
        cancelledAt: '2026-08-01T09:00:00.000Z',
      }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: progressQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({
        status: 'COMPLETED',
        completedAt: '2026-08-01T09:00:00.000Z',
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: progressQueryKeys.all }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );
  });
});
