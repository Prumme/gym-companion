import { act, fireEvent, render, screen } from '@testing-library/react';
import type { WorkoutSessionExerciseDetail } from '@gym-companion/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IntervalTimerSheet } from '../components/IntervalTimerSheet';
import { useIntervalTimerStore } from '../stores/interval-timer-store';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const mutateAsync = vi.fn();

vi.mock('../hooks/use-workout-mutations', () => ({
  useUpdateWorkoutSetMutation: () => ({ mutateAsync }),
}));

vi.mock('../lib/interval-cues', () => ({
  unlockIntervalAudio: vi.fn(),
  playIntervalPhaseCue: vi.fn(),
}));

function cardioExercise(): WorkoutSessionExerciseDetail {
  const base = createWorkoutSessionDetail().exercises[0]!;
  return {
    ...base,
    id: 'wse-cardio',
    exerciseName: 'Course sur tapis',
    measurementType: 'DISTANCE_DURATION',
    cardioType: 'TREADMILL',
    sets: [
      createWorkoutSet({
        id: 'set-work',
        position: 0,
        setType: 'INTERVAL_WORK',
        targetWeightKg: null,
        targetRepMin: null,
        targetRepMax: null,
        targetRir: null,
        targetDurationSeconds: 3,
        targetSpeedKmh: 8,
      }),
      createWorkoutSet({
        id: 'set-recovery',
        position: 1,
        setType: 'INTERVAL_RECOVERY',
        targetWeightKg: null,
        targetRepMin: null,
        targetRepMax: null,
        targetRir: null,
        targetDurationSeconds: 2,
        targetSpeedKmh: 4,
      }),
    ],
  };
}

describe('IntervalTimerSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateAsync.mockReset();
    useIntervalTimerStore.setState({ timer: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enchaîne les phases puis enregistre les séries après confirmation', async () => {
    const session = createWorkoutSessionDetail({ version: 7 });
    const exercise = cardioExercise();
    mutateAsync
      .mockResolvedValueOnce({ kind: 'server', result: { workoutSessionVersion: 8 } })
      .mockResolvedValueOnce({ kind: 'server', result: { workoutSessionVersion: 9 } });
    const onClose = vi.fn();

    render(
      <IntervalTimerSheet
        open
        session={session}
        exercise={exercise}
        onClose={onClose}
        onVersionConflict={vi.fn()}
      />,
    );

    expect(screen.getByText('Fractionné 1 × (3″ à 8 km/h / 2″ à 4 km/h)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));

    expect(screen.getByText('Effort')).toBeInTheDocument();
    expect(screen.getByText('8 km/h')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3_250);
    });
    expect(screen.getByText('Récupération')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_250);
    });
    expect(screen.getByText('Fractionné terminé')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer 2 séries' }));
    });

    expect(mutateAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workoutSetId: 'set-work',
        input: expect.objectContaining({
          status: 'COMPLETED',
          actualDurationSeconds: 3,
          expectedVersion: 7,
        }),
      }),
    );
    expect(mutateAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workoutSetId: 'set-recovery',
        input: expect.objectContaining({ actualDurationSeconds: 2, expectedVersion: 8 }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(useIntervalTimerStore.getState().timer).toBeNull();
  });

  it('n’enregistre rien quand on abandonne', () => {
    render(
      <IntervalTimerSheet
        open
        session={createWorkoutSessionDetail()}
        exercise={cardioExercise()}
        onClose={vi.fn()}
        onVersionConflict={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
    expect(screen.getByText('Fractionné terminé')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ne rien enregistrer' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(useIntervalTimerStore.getState().timer).toBeNull();
  });
});
