import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSyncSharedCurrentExercise } from '../hooks/use-sync-shared-current-exercise';

const getSharedWorkoutSessionContext = vi.fn();
const setMySharedCurrentExercise = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  getSharedWorkoutSessionContext: (...args: unknown[]) =>
    getSharedWorkoutSessionContext(...args),
  setMySharedCurrentExercise: (...args: unknown[]) =>
    setMySharedCurrentExercise(...args),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useSyncSharedCurrentExercise', () => {
  beforeEach(() => {
    getSharedWorkoutSessionContext.mockReset();
    setMySharedCurrentExercise.mockReset();
    setMySharedCurrentExercise.mockResolvedValue({
      linked: true,
      workoutSession: null,
      activeWorkoutElsewhere: null,
      currentWorkoutSessionExerciseId: null,
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('n’appelle pas le PUT si session non liée', async () => {
    getSharedWorkoutSessionContext.mockResolvedValue({
      linked: false,
      room: null,
      currentWorkoutSessionExerciseId: null,
    });

    renderHook(
      () => useSyncSharedCurrentExercise('ws-1', 'ex-1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(getSharedWorkoutSessionContext).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(setMySharedCurrentExercise).not.toHaveBeenCalled();
  });

  it('PUT current exercise si room ACTIVE et sélection différente', async () => {
    getSharedWorkoutSessionContext.mockResolvedValue({
      linked: true,
      room: { id: 'room-1', name: 'Duo', status: 'ACTIVE' },
      currentWorkoutSessionExerciseId: null,
    });

    renderHook(
      () => useSyncSharedCurrentExercise('ws-1', 'ex-1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(setMySharedCurrentExercise).toHaveBeenCalledWith('room-1', {
        workoutSessionExerciseId: 'ex-1',
      });
    });
  });

  it('pas d’appel offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    getSharedWorkoutSessionContext.mockResolvedValue({
      linked: true,
      room: { id: 'room-1', name: 'Duo', status: 'ACTIVE' },
      currentWorkoutSessionExerciseId: null,
    });

    renderHook(
      () => useSyncSharedCurrentExercise('ws-1', 'ex-1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(getSharedWorkoutSessionContext).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(setMySharedCurrentExercise).not.toHaveBeenCalled();
  });

  it('pas de spam si même exercice déjà synchronisé', async () => {
    getSharedWorkoutSessionContext.mockResolvedValue({
      linked: true,
      room: { id: 'room-1', name: 'Duo', status: 'ACTIVE' },
      currentWorkoutSessionExerciseId: 'ex-1',
    });

    renderHook(
      () => useSyncSharedCurrentExercise('ws-1', 'ex-1'),
      { wrapper },
    );

    await waitFor(() => {
      expect(getSharedWorkoutSessionContext).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(setMySharedCurrentExercise).not.toHaveBeenCalled();
  });
});
