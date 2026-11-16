import { describe, expect, it } from 'vitest';

import {
  buildIntervalPhases,
  hasIntervalSets,
  intervalRoundProgress,
  pauseIntervalTimer,
  remainingPhaseSeconds,
  resumeIntervalTimer,
  skipIntervalPhase,
  startIntervalTimer,
  stopIntervalTimer,
  tickIntervalTimer,
  type IntervalPhase,
} from '../lib/interval-timer';
import { createWorkoutSet } from './fixtures';

const phases: IntervalPhase[] = [
  { setId: 'w', kind: 'WARMUP', durationSeconds: 30, speedKmh: 4, inclinePercent: null },
  { setId: 'e1', kind: 'WORK', durationSeconds: 60, speedKmh: 8, inclinePercent: null },
  { setId: 'r1', kind: 'RECOVERY', durationSeconds: 60, speedKmh: 4, inclinePercent: null },
  { setId: 'e2', kind: 'WORK', durationSeconds: 60, speedKmh: 8, inclinePercent: null },
];

const start = (nowMs = 0) =>
  startIntervalTimer({ workoutSessionId: 's', sessionExerciseId: 'x', phases, nowMs });

describe('interval timer', () => {
  it('construit les phases à partir des séries en attente', () => {
    const sets = [
      createWorkoutSet({ id: 'b', position: 1, setType: 'INTERVAL_WORK', targetDurationSeconds: 60, targetSpeedKmh: 8 }),
      createWorkoutSet({ id: 'a', position: 0, setType: 'WARMUP', targetDurationSeconds: 300 }),
      createWorkoutSet({ id: 'c', position: 2, setType: 'INTERVAL_RECOVERY', targetDurationSeconds: 60, status: 'COMPLETED' }),
    ];
    expect(hasIntervalSets(sets)).toBe(true);
    expect(buildIntervalPhases(sets).map((phase) => [phase.setId, phase.kind])).toEqual([
      ['a', 'WARMUP'],
      ['b', 'WORK'],
    ]);
  });

  it('enchaîne les phases et rattrape le temps passé en arrière-plan', () => {
    const state = tickIntervalTimer(start(), 100_000);
    expect(state.phaseIndex).toBe(2);
    expect(state.completed.map((phase) => phase.setId)).toEqual(['w', 'e1']);
    expect(remainingPhaseSeconds(state, 100_000)).toBe(50);
    expect(intervalRoundProgress(state)).toEqual({ current: 1, total: 2 });
  });

  it('termine après la dernière phase', () => {
    const state = tickIntervalTimer(start(), 210_000);
    expect(state.finished).toBe(true);
    expect(state.completed).toHaveLength(4);
  });

  it('met en pause sans faire avancer le temps', () => {
    const paused = pauseIntervalTimer(start(), 10_000);
    expect(remainingPhaseSeconds(paused, 500_000)).toBe(20);
    expect(tickIntervalTimer(paused, 500_000).phaseIndex).toBe(0);
    const resumed = resumeIntervalTimer(paused, 500_000);
    expect(remainingPhaseSeconds(resumed, 505_000)).toBe(15);
  });

  it('passe une phase avec la durée réellement faite', () => {
    const skipped = skipIntervalPhase(start(), 12_400);
    expect(skipped.completed).toEqual([{ setId: 'w', kind: 'WARMUP', durationSeconds: 12 }]);
    expect(skipped.phaseIndex).toBe(1);
    expect(remainingPhaseSeconds(skipped, 12_400)).toBe(60);
  });

  it('arrête en comptant la phase entamée', () => {
    const stopped = stopIntervalTimer(start(), 45_000);
    expect(stopped.finished).toBe(true);
    expect(stopped.completed).toEqual([
      { setId: 'w', kind: 'WARMUP', durationSeconds: 30 },
      { setId: 'e1', kind: 'WORK', durationSeconds: 15 },
    ]);
  });
});
