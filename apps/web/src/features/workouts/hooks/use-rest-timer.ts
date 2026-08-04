import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  adjustRestTimer,
  clearOtherRestTimers,
  clearRestTimerStorage,
  createRestTimerState,
  getRemainingSeconds,
  pauseRestTimer,
  readRestTimerFromStorage,
  resumeRestTimer,
  sanitizeRestTimerState,
  writeRestTimerToStorage,
  type RestTimerPersistedState,
} from '../lib/rest-timer-storage';

type UseRestTimerOptions = {
  workoutSessionId: string | null;
  enabled?: boolean;
};

function subscribeVisibility(onStoreChange: () => void) {
  const onVisibility = () => onStoreChange();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onStoreChange);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onStoreChange);
  };
}

function getVisibilitySnapshot() {
  return document.visibilityState;
}

export function useRestTimer({
  workoutSessionId,
  enabled = true,
}: UseRestTimerOptions) {
  const [state, setState] = useState<RestTimerPersistedState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [justExpired, setJustExpired] = useState(false);
  const expiredNotifiedRef = useRef(false);
  const visibility = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    () => 'visible' as DocumentVisibilityState,
  );

  useEffect(() => {
    if (!workoutSessionId || !enabled) {
      setState(null);
      return;
    }
    clearOtherRestTimers(workoutSessionId);
    const stored = sanitizeRestTimerState(
      readRestTimerFromStorage(workoutSessionId),
      workoutSessionId,
    );
    setState(stored);
    expiredNotifiedRef.current = false;
    setJustExpired(false);
  }, [workoutSessionId, enabled]);

  useEffect(() => {
    if (!state || !workoutSessionId) {
      return;
    }
    writeRestTimerToStorage(state);
  }, [state, workoutSessionId]);

  useEffect(() => {
    if (!state) {
      return;
    }
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [state, visibility]);

  const remainingSeconds = state ? getRemainingSeconds(state, nowMs) : 0;
  const isRunning = Boolean(state && !state.isPaused && remainingSeconds > 0);
  const isPaused = Boolean(state?.isPaused);
  const isExpired = Boolean(state && remainingSeconds <= 0 && !state.isPaused);

  useEffect(() => {
    if (isExpired && state && !expiredNotifiedRef.current) {
      expiredNotifiedRef.current = true;
      setJustExpired(true);
      if (workoutSessionId) {
        clearRestTimerStorage(workoutSessionId);
      }
    }
  }, [isExpired, state, workoutSessionId]);

  const start = useCallback(
    (durationSeconds: number, sourceWorkoutSetId: string | null = null) => {
      if (!workoutSessionId || durationSeconds <= 0) {
        return;
      }
      expiredNotifiedRef.current = false;
      setJustExpired(false);
      setState(
        createRestTimerState({
          workoutSessionId,
          sourceWorkoutSetId,
          durationSeconds,
        }),
      );
    },
    [workoutSessionId],
  );

  const pause = useCallback(() => {
    setState((current) => (current ? pauseRestTimer(current) : current));
  }, []);

  const resume = useCallback(() => {
    setState((current) => (current ? resumeRestTimer(current) : current));
  }, []);

  const stop = useCallback(() => {
    if (workoutSessionId) {
      clearRestTimerStorage(workoutSessionId);
    }
    setState(null);
    setJustExpired(false);
    expiredNotifiedRef.current = false;
  }, [workoutSessionId]);

  const addSeconds = useCallback((delta: number) => {
    setState((current) => (current ? adjustRestTimer(current, delta) : current));
    if (delta > 0) {
      expiredNotifiedRef.current = false;
      setJustExpired(false);
    }
  }, []);

  const clearExpiredBanner = useCallback(() => {
    setJustExpired(false);
    if (workoutSessionId) {
      clearRestTimerStorage(workoutSessionId);
    }
    setState(null);
  }, [workoutSessionId]);

  return {
    state,
    remainingSeconds,
    isRunning,
    isPaused,
    isExpired,
    justExpired,
    start,
    pause,
    resume,
    stop,
    addSeconds,
    clearExpiredBanner,
  };
}
