import { describe, expect, it } from 'vitest';

import {
  adjustRestTimer,
  clearOtherRestTimers,
  clearRestTimerStorage,
  createRestTimerState,
  getRemainingSeconds,
  pauseRestTimer,
  readRestTimerFromStorage,
  resumeRestTimer,
  REST_TIMER_MAX_SECONDS,
  sanitizeRestTimerState,
  writeRestTimerToStorage,
} from '../lib/rest-timer-storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

describe('rest-timer-storage', () => {
  it('crée un état initial avec endsAtEpochMs absolu', () => {
    const now = 1_000_000;
    const state = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: 's1',
      durationSeconds: 90,
      nowMs: now,
    });
    expect(state.startedAtEpochMs).toBe(now);
    expect(state.endsAtEpochMs).toBe(now + 90_000);
    expect(state.isPaused).toBe(false);
    expect(getRemainingSeconds(state, now)).toBe(90);
  });

  it('calcule le temps restant depuis endsAtEpochMs', () => {
    const state = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: null,
      durationSeconds: 60,
      nowMs: 0,
    });
    expect(getRemainingSeconds(state, 25_000)).toBe(35);
  });

  it('met en pause et reprend sans dérive', () => {
    const started = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: null,
      durationSeconds: 60,
      nowMs: 0,
    });
    const paused = pauseRestTimer(started, 20_000);
    expect(paused.isPaused).toBe(true);
    expect(paused.pausedRemainingSeconds).toBe(40);
    expect(getRemainingSeconds(paused, 999_999)).toBe(40);

    const resumed = resumeRestTimer(paused, 100_000);
    expect(resumed.isPaused).toBe(false);
    expect(resumed.endsAtEpochMs).toBe(140_000);
    expect(getRemainingSeconds(resumed, 100_000)).toBe(40);
  });

  it('ajoute et retire des secondes sans négatif ni dépasser le max', () => {
    const state = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: null,
      durationSeconds: 30,
      nowMs: 0,
    });
    const plus = adjustRestTimer(state, 15, 0);
    expect(getRemainingSeconds(plus, 0)).toBe(45);
    const minus = adjustRestTimer(plus, -100, 0);
    expect(getRemainingSeconds(minus, 0)).toBe(0);
    const capped = adjustRestTimer(state, REST_TIMER_MAX_SECONDS + 100, 0);
    expect(getRemainingSeconds(capped, 0)).toBe(REST_TIMER_MAX_SECONDS);
  });

  it('détecte l’expiration', () => {
    const state = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: null,
      durationSeconds: 10,
      nowMs: 0,
    });
    expect(getRemainingSeconds(state, 10_000)).toBe(0);
  });

  it('nettoie une minuterie d’une autre séance et une expirée depuis longtemps', () => {
    expect(
      sanitizeRestTimerState(
        createRestTimerState({
          workoutSessionId: 'old',
          sourceWorkoutSetId: null,
          durationSeconds: 30,
        }),
        'current',
      ),
    ).toBeNull();

    const expired = createRestTimerState({
      workoutSessionId: 'w1',
      sourceWorkoutSetId: null,
      durationSeconds: 10,
      nowMs: 0,
    });
    expect(sanitizeRestTimerState(expired, 'w1', 200_000)).toBeNull();
    expect(sanitizeRestTimerState(expired, 'w1', 30_000)).not.toBeNull();
  });

  it('persiste sans données sensibles', () => {
    const storage = memoryStorage();
    const state = createRestTimerState({
      workoutSessionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sourceWorkoutSetId: 'ws-1',
      durationSeconds: 90,
      nowMs: 1_000,
    });
    writeRestTimerToStorage(state, storage);
    const dumped = JSON.stringify(storage.dump());
    expect(dumped).not.toMatch(/token|password|email|Bearer/i);
    expect(dumped).not.toContain('actualWeightKg');
    expect(readRestTimerFromStorage(state.workoutSessionId, storage)).toEqual(
      state,
    );
    clearRestTimerStorage(state.workoutSessionId, storage);
    expect(
      readRestTimerFromStorage(state.workoutSessionId, storage),
    ).toBeNull();
  });

  it('supprime les minuteries des autres séances', () => {
    const storage = memoryStorage();
    writeRestTimerToStorage(
      createRestTimerState({
        workoutSessionId: 'old',
        sourceWorkoutSetId: null,
        durationSeconds: 30,
      }),
      storage,
    );
    writeRestTimerToStorage(
      createRestTimerState({
        workoutSessionId: 'current',
        sourceWorkoutSetId: null,
        durationSeconds: 30,
      }),
      storage,
    );
    clearOtherRestTimers('current', storage);
    expect(readRestTimerFromStorage('old', storage)).toBeNull();
    expect(readRestTimerFromStorage('current', storage)).not.toBeNull();
  });
});
