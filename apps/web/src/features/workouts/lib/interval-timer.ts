import type { WorkoutSessionSetDetail } from '@gym-companion/shared';

/** Phase du chrono de fractionné, dérivée d’une série de la séance. */
export type IntervalPhaseKind = 'WARMUP' | 'WORK' | 'RECOVERY' | 'COOLDOWN';

export type IntervalPhase = {
  setId: string;
  kind: IntervalPhaseKind;
  durationSeconds: number;
  speedKmh: number | null;
  inclinePercent: number | null;
};

export type CompletedIntervalPhase = {
  setId: string;
  kind: IntervalPhaseKind;
  durationSeconds: number;
};

/**
 * État persistable du chrono. Basé sur des horodatages : le temps écoulé est
 * recalculé à chaque lecture, ce qui survit à la mise en veille de l’écran.
 */
export type IntervalTimerState = {
  workoutSessionId: string;
  sessionExerciseId: string;
  phases: IntervalPhase[];
  phaseIndex: number;
  phaseStartedAtMs: number;
  pausedAtMs: number | null;
  completed: CompletedIntervalPhase[];
  finished: boolean;
};

export const INTERVAL_PHASE_LABELS: Record<IntervalPhaseKind, string> = {
  WARMUP: 'Échauffement',
  WORK: 'Effort',
  RECOVERY: 'Récupération',
  COOLDOWN: 'Retour au calme',
};

function phaseKind(setType: WorkoutSessionSetDetail['setType']): IntervalPhaseKind {
  switch (setType) {
    case 'WARMUP':
      return 'WARMUP';
    case 'INTERVAL_WORK':
      return 'WORK';
    case 'INTERVAL_RECOVERY':
      return 'RECOVERY';
    default:
      return 'COOLDOWN';
  }
}

export function hasIntervalSets(sets: readonly Pick<WorkoutSessionSetDetail, 'setType'>[]): boolean {
  return sets.some((set) => set.setType === 'INTERVAL_WORK');
}

/** Phases à enchaîner : séries encore à faire, dans l’ordre, avec une durée cible. */
export function buildIntervalPhases(sets: readonly WorkoutSessionSetDetail[]): IntervalPhase[] {
  return [...sets]
    .sort((a, b) => a.position - b.position)
    .filter(
      (set) =>
        set.status === 'PENDING' &&
        set.targetDurationSeconds != null &&
        set.targetDurationSeconds > 0,
    )
    .map((set) => ({
      setId: set.id,
      kind: phaseKind(set.setType),
      durationSeconds: set.targetDurationSeconds!,
      speedKmh: set.targetSpeedKmh ?? null,
      inclinePercent: set.targetInclinePercent ?? null,
    }));
}

export function startIntervalTimer(input: {
  workoutSessionId: string;
  sessionExerciseId: string;
  phases: IntervalPhase[];
  nowMs: number;
}): IntervalTimerState {
  return {
    workoutSessionId: input.workoutSessionId,
    sessionExerciseId: input.sessionExerciseId,
    phases: input.phases,
    phaseIndex: 0,
    phaseStartedAtMs: input.nowMs,
    pausedAtMs: null,
    completed: [],
    finished: input.phases.length === 0,
  };
}

function elapsedMs(state: IntervalTimerState, nowMs: number): number {
  const reference = state.pausedAtMs ?? nowMs;
  return Math.max(0, reference - state.phaseStartedAtMs);
}

function finishPhase(
  state: IntervalTimerState,
  durationSeconds: number,
  nextStartMs: number,
): IntervalTimerState {
  const phase = state.phases[state.phaseIndex]!;
  const completed = [
    ...state.completed,
    { setId: phase.setId, kind: phase.kind, durationSeconds },
  ];
  const phaseIndex = state.phaseIndex + 1;
  return {
    ...state,
    completed,
    phaseIndex,
    phaseStartedAtMs: nextStartMs,
    finished: phaseIndex >= state.phases.length,
  };
}

/**
 * Avance automatiquement les phases dont la durée est écoulée (rattrapage
 * possible de plusieurs phases après une mise en arrière-plan).
 */
export function tickIntervalTimer(state: IntervalTimerState, nowMs: number): IntervalTimerState {
  let next = state;
  while (!next.finished && next.pausedAtMs == null) {
    const phase = next.phases[next.phaseIndex]!;
    const endMs = next.phaseStartedAtMs + phase.durationSeconds * 1000;
    if (nowMs < endMs) break;
    next = finishPhase(next, phase.durationSeconds, endMs);
  }
  return next;
}

export function pauseIntervalTimer(state: IntervalTimerState, nowMs: number): IntervalTimerState {
  const ticked = tickIntervalTimer(state, nowMs);
  if (ticked.finished || ticked.pausedAtMs != null) return ticked;
  return { ...ticked, pausedAtMs: nowMs };
}

export function resumeIntervalTimer(state: IntervalTimerState, nowMs: number): IntervalTimerState {
  if (state.pausedAtMs == null || state.finished) return state;
  return {
    ...state,
    phaseStartedAtMs: state.phaseStartedAtMs + (nowMs - state.pausedAtMs),
    pausedAtMs: null,
  };
}

/** Termine la phase en cours avec la durée réellement faite (arrondie à la seconde). */
export function skipIntervalPhase(state: IntervalTimerState, nowMs: number): IntervalTimerState {
  const ticked = tickIntervalTimer(state, nowMs);
  if (ticked.finished) return ticked;
  const done = Math.round(elapsedMs(ticked, nowMs) / 1000);
  const next = finishPhase(ticked, done, nowMs);
  return { ...next, pausedAtMs: ticked.pausedAtMs == null ? null : nowMs };
}

/** Arrête le chrono : la phase entamée (≥ 1 s) est comptée avec sa durée réelle. */
export function stopIntervalTimer(state: IntervalTimerState, nowMs: number): IntervalTimerState {
  const ticked = tickIntervalTimer(state, nowMs);
  if (ticked.finished) return ticked;
  const done = Math.round(elapsedMs(ticked, nowMs) / 1000);
  const completed =
    done >= 1
      ? [
          ...ticked.completed,
          {
            setId: ticked.phases[ticked.phaseIndex]!.setId,
            kind: ticked.phases[ticked.phaseIndex]!.kind,
            durationSeconds: done,
          },
        ]
      : ticked.completed;
  return { ...ticked, completed, pausedAtMs: null, finished: true };
}

export function currentIntervalPhase(state: IntervalTimerState): IntervalPhase | null {
  return state.finished ? null : (state.phases[state.phaseIndex] ?? null);
}

export function nextIntervalPhase(state: IntervalTimerState): IntervalPhase | null {
  return state.finished ? null : (state.phases[state.phaseIndex + 1] ?? null);
}

export function remainingPhaseSeconds(state: IntervalTimerState, nowMs: number): number {
  const phase = currentIntervalPhase(state);
  if (!phase) return 0;
  return Math.max(0, Math.ceil(phase.durationSeconds - elapsedMs(state, nowMs) / 1000));
}

/** Numéro du round d’effort en cours (1-based) et nombre total de rounds. */
export function intervalRoundProgress(state: IntervalTimerState): { current: number; total: number } {
  const total = state.phases.filter((phase) => phase.kind === 'WORK').length;
  const doneWork = state.phases
    .slice(0, state.phaseIndex)
    .filter((phase) => phase.kind === 'WORK').length;
  const current = currentIntervalPhase(state)?.kind === 'WORK' ? doneWork + 1 : doneWork;
  return { current: Math.min(Math.max(current, 0), total), total };
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
