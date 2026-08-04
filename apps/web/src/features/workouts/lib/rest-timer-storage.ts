export const REST_TIMER_MAX_SECONDS = 30 * 60;
export const REST_TIMER_STEP_SECONDS = 15;

export type RestTimerPersistedState = {
  workoutSessionId: string;
  sourceWorkoutSetId: string | null;
  startedAtEpochMs: number;
  endsAtEpochMs: number;
  durationSeconds: number;
  isPaused: boolean;
  pausedRemainingSeconds: number | null;
};

const STORAGE_PREFIX = 'gym-companion:rest-timer:';

export function restTimerStorageKey(workoutSessionId: string): string {
  return `${STORAGE_PREFIX}${workoutSessionId}`;
}

export function createRestTimerState(input: {
  workoutSessionId: string;
  sourceWorkoutSetId: string | null;
  durationSeconds: number;
  nowMs?: number;
}): RestTimerPersistedState {
  const now = input.nowMs ?? Date.now();
  const durationSeconds = clampRestDuration(input.durationSeconds);
  return {
    workoutSessionId: input.workoutSessionId,
    sourceWorkoutSetId: input.sourceWorkoutSetId,
    startedAtEpochMs: now,
    endsAtEpochMs: now + durationSeconds * 1000,
    durationSeconds,
    isPaused: false,
    pausedRemainingSeconds: null,
  };
}

export function clampRestDuration(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(Math.floor(seconds), REST_TIMER_MAX_SECONDS);
}

export function getRemainingSeconds(
  state: RestTimerPersistedState,
  nowMs: number = Date.now(),
): number {
  if (state.isPaused) {
    return Math.max(0, state.pausedRemainingSeconds ?? 0);
  }
  return Math.max(0, Math.ceil((state.endsAtEpochMs - nowMs) / 1000));
}

export function pauseRestTimer(
  state: RestTimerPersistedState,
  nowMs: number = Date.now(),
): RestTimerPersistedState {
  if (state.isPaused) {
    return state;
  }
  return {
    ...state,
    isPaused: true,
    pausedRemainingSeconds: getRemainingSeconds(state, nowMs),
  };
}

export function resumeRestTimer(
  state: RestTimerPersistedState,
  nowMs: number = Date.now(),
): RestTimerPersistedState {
  if (!state.isPaused) {
    return state;
  }
  const remaining = Math.max(0, state.pausedRemainingSeconds ?? 0);
  return {
    ...state,
    isPaused: false,
    pausedRemainingSeconds: null,
    startedAtEpochMs: nowMs,
    endsAtEpochMs: nowMs + remaining * 1000,
  };
}

export function adjustRestTimer(
  state: RestTimerPersistedState,
  deltaSeconds: number,
  nowMs: number = Date.now(),
): RestTimerPersistedState {
  const remaining = getRemainingSeconds(state, nowMs);
  const next = clampRestDuration(remaining + deltaSeconds);
  if (state.isPaused) {
    return {
      ...state,
      pausedRemainingSeconds: next,
      durationSeconds: Math.max(state.durationSeconds, next),
    };
  }
  return {
    ...state,
    endsAtEpochMs: nowMs + next * 1000,
    durationSeconds: Math.max(state.durationSeconds, next),
  };
}

export function formatRestCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function readRestTimerFromStorage(
  workoutSessionId: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): RestTimerPersistedState | null {
  try {
    const raw = storage.getItem(restTimerStorageKey(workoutSessionId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as RestTimerPersistedState;
    if (
      !parsed ||
      parsed.workoutSessionId !== workoutSessionId ||
      typeof parsed.endsAtEpochMs !== 'number' ||
      typeof parsed.startedAtEpochMs !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeRestTimerToStorage(
  state: RestTimerPersistedState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(restTimerStorageKey(state.workoutSessionId), JSON.stringify(state));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearRestTimerStorage(
  workoutSessionId: string,
  storage: Pick<Storage, 'removeItem'> = localStorage,
): void {
  try {
    storage.removeItem(restTimerStorageKey(workoutSessionId));
  } catch {
    // ignore
  }
}

/** Supprime les minuteries locales d’autres séances. */
export function clearOtherRestTimers(
  currentWorkoutSessionId: string,
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = localStorage,
): void {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key?.startsWith(STORAGE_PREFIX) &&
        key !== restTimerStorageKey(currentWorkoutSessionId)
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** Supprime une minuterie expirée depuis plus de 2 minutes ou invalide. */
export function sanitizeRestTimerState(
  state: RestTimerPersistedState | null,
  workoutSessionId: string,
  nowMs: number = Date.now(),
): RestTimerPersistedState | null {
  if (!state || state.workoutSessionId !== workoutSessionId) {
    return null;
  }
  const remaining = getRemainingSeconds(state, nowMs);
  if (remaining <= 0 && !state.isPaused) {
    const expiredFor = nowMs - state.endsAtEpochMs;
    if (expiredFor > 120_000) {
      return null;
    }
  }
  return state;
}
