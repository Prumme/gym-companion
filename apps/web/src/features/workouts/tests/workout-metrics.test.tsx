import type { WorkoutMetrics } from '@gym-companion/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkoutMetricsSummary } from '../components/WorkoutMetricsSummary';
import {
  formatWorkoutVolume,
  getWorkoutMetricsDisplayFlags,
} from '../lib/workout-metrics-format';

function metrics(overrides: Partial<WorkoutMetrics> = {}): WorkoutMetrics {
  return {
    exerciseCount: 2,
    performedExerciseCount: 2,
    sets: {
      total: 10,
      processed: 10,
      performed: 8,
      completed: 6,
      partial: 1,
      failed: 1,
      skipped: 0,
      pending: 0,
      cancelled: 0,
      warmup: 1,
      working: 9,
      reachedFailure: 1,
    },
    performance: {
      totalReps: 112,
      totalExternalVolumeKg: 6000,
      workingExternalVolumeKg: 5480,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
    },
    elapsedDurationSeconds: 4320,
    ...overrides,
  };
}

describe('workout metrics format / UI', () => {
  it('formate le volume en kg·rep', () => {
    expect(formatWorkoutVolume(5480)).toMatch(/5[\s\u202f]?480 kg·rep/);
  });

  it('masque distance/durée/volume à zéro', () => {
    const flags = getWorkoutMetricsDisplayFlags(metrics());
    expect(flags.showReps).toBe(true);
    expect(flags.showVolume).toBe(true);
    expect(flags.showDistance).toBe(false);
    expect(flags.showExerciseDuration).toBe(false);
    expect(flags.showElapsed).toBe(true);
  });

  it('affiche le résumé COMPLETED pertinent', () => {
    render(<WorkoutMetricsSummary metrics={metrics()} />);
    expect(
      screen.getByRole('heading', { name: 'Résumé de la séance' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 exercices réalisés/)).toBeInTheDocument();
    expect(screen.getByText(/8 séries réalisées/)).toBeInTheDocument();
    expect(screen.getByText(/112 répétitions/)).toBeInTheDocument();
    expect(screen.getByText(/volume de travail/)).toBeInTheDocument();
    expect(screen.getByText(/Durée écoulée/)).toBeInTheDocument();
    expect(screen.queryByText(/Distance/)).not.toBeInTheDocument();
  });

  it('affiche durée et distance quand pertinentes', () => {
    render(
      <WorkoutMetricsSummary
        metrics={metrics({
          performance: {
            totalReps: 0,
            totalExternalVolumeKg: 0,
            workingExternalVolumeKg: 0,
            totalDurationSeconds: 400,
            totalDistanceMeters: 1500,
          },
        })}
      />,
    );
    expect(screen.getByText(/Durée d’exercices enregistrée/)).toBeInTheDocument();
    expect(screen.getByText(/Distance/)).toBeInTheDocument();
    expect(screen.queryByText(/volume de travail/)).not.toBeInTheDocument();
  });
});
