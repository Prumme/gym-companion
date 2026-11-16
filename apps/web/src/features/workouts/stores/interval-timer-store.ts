import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  pauseIntervalTimer,
  resumeIntervalTimer,
  skipIntervalPhase,
  startIntervalTimer,
  stopIntervalTimer,
  tickIntervalTimer,
  type CompletedIntervalPhase,
  type IntervalPhase,
  type IntervalTimerState,
} from '../lib/interval-timer';

type IntervalTimerStore = {
  timer: IntervalTimerState | null;
  start: (input: {
    workoutSessionId: string;
    sessionExerciseId: string;
    phases: IntervalPhase[];
  }) => void;
  tick: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  /** Retire les phases déjà enregistrées côté séance (reprise après erreur). */
  markRecorded: (recorded: CompletedIntervalPhase[]) => void;
  clear: () => void;
};

function update(
  get: () => IntervalTimerStore,
  set: (partial: Partial<IntervalTimerStore>) => void,
  fn: (timer: IntervalTimerState, nowMs: number) => IntervalTimerState,
) {
  const timer = get().timer;
  if (!timer) return;
  const next = fn(timer, Date.now());
  if (next !== timer) set({ timer: next });
}

/**
 * Chrono de fractionné en cours (état client temporaire, non synchronisé).
 * Persisté localement pour survivre à un rechargement ; rien n’est écrit
 * dans la séance avant la confirmation de l’utilisateur.
 */
export const useIntervalTimerStore = create<IntervalTimerStore>()(
  persist(
    (set, get) => ({
      timer: null,
      start: (input) =>
        set({ timer: startIntervalTimer({ ...input, nowMs: Date.now() }) }),
      tick: () => update(get, set, tickIntervalTimer),
      pause: () => update(get, set, pauseIntervalTimer),
      resume: () => update(get, set, resumeIntervalTimer),
      skip: () => update(get, set, skipIntervalPhase),
      stop: () => update(get, set, stopIntervalTimer),
      markRecorded: (recorded) => {
        const timer = get().timer;
        if (!timer) return;
        const ids = new Set(recorded.map((phase) => phase.setId));
        set({
          timer: {
            ...timer,
            completed: timer.completed.filter((phase) => !ids.has(phase.setId)),
          },
        });
      },
      clear: () => set({ timer: null }),
    }),
    {
      name: 'gym-companion:interval-timer',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ timer: state.timer }),
    },
  ),
);
