import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRestTimer } from '../hooks/use-rest-timer';
import {
  createRestTimerState,
  restTimerStorageKey,
  writeRestTimerToStorage,
} from '../lib/rest-timer-storage';

describe('useRestTimer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('démarre, pause, reprend, ajuste et arrête sans mutation API', () => {
    const { result } = renderHook(() =>
      useRestTimer({ workoutSessionId: 'w1', enabled: true }),
    );

    act(() => {
      result.current.start(90, 'ws-1');
    });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.remainingSeconds).toBe(90);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);
    expect(result.current.remainingSeconds).toBe(90);

    act(() => {
      result.current.resume();
    });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      result.current.addSeconds(15);
    });
    expect(result.current.remainingSeconds).toBe(105);

    act(() => {
      result.current.addSeconds(-200);
    });
    expect(result.current.remainingSeconds).toBe(0);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isRunning).toBe(false);
    expect(localStorage.getItem(restTimerStorageKey('w1'))).toBeNull();
  });

  it('restaure depuis localStorage et recalcule après avance du temps', () => {
    const now = Date.now();
    writeRestTimerToStorage(
      createRestTimerState({
        workoutSessionId: 'w1',
        sourceWorkoutSetId: 'ws-1',
        durationSeconds: 120,
        nowMs: now,
      }),
    );

    const { result } = renderHook(() =>
      useRestTimer({ workoutSessionId: 'w1', enabled: true }),
    );
    expect(result.current.remainingSeconds).toBe(120);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(90);
  });

  it('nettoie une minuterie d’une autre séance au montage', () => {
    writeRestTimerToStorage(
      createRestTimerState({
        workoutSessionId: 'old',
        sourceWorkoutSetId: null,
        durationSeconds: 60,
      }),
    );
    renderHook(() => useRestTimer({ workoutSessionId: 'w1', enabled: true }));
    expect(localStorage.getItem(restTimerStorageKey('old'))).toBeNull();
  });

  it('signale l’expiration', () => {
    const { result } = renderHook(() =>
      useRestTimer({ workoutSessionId: 'w1', enabled: true }),
    );
    act(() => {
      result.current.start(1, null);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.justExpired || result.current.remainingSeconds === 0).toBe(
      true,
    );
  });
});
