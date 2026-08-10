import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { personalRecordQueryKeys } from '../api/personal-record-query-keys';
import { applyLifecycleToCacheForTest } from '@/features/workouts/hooks/use-workout-mutations';
import { createWorkoutSessionDetail } from '@/features/workouts/tests/fixtures';

describe('personal records cache invalidation rules', () => {
  it('invalide les records uniquement après COMPLETE confirmé', () => {
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
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({ status: 'PAUSED' }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({ status: 'CANCELLED' }),
    );
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );

    applyLifecycleToCacheForTest(
      queryClient,
      createWorkoutSessionDetail({ status: 'COMPLETED' }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: personalRecordQueryKeys.all }),
    );
  });
});
