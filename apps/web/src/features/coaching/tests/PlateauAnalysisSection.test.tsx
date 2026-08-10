import type { PlateauAnalysis } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlateauAnalysisSection } from '../components/PlateauAnalysisSection';

const { getPlateauAnalysis } = vi.hoisted(() => ({
  getPlateauAnalysis: vi.fn(),
}));

vi.mock('../api/coaching-api', () => ({
  getPlateauAnalysis: (...args: unknown[]) => getPlateauAnalysis(...args),
}));

function baseAnalysis(
  overrides: Partial<PlateauAnalysis> = {},
): PlateauAnalysis {
  return {
    exerciseId: 'ex-1',
    supported: true,
    status: 'NONE',
    range: {
      analyzedWorkoutCount: 4,
      firstWorkoutDate: '2026-08-01',
      latestWorkoutDate: '2026-08-04',
    },
    current: {
      maxWeightKg: 80,
      maxReps: 9,
      estimatedOneRepMaxKg: 104,
    },
    trend: {
      loadChangeKg: 0,
      e1rmChangeKg: 0.5,
      e1rmChangePercent: 0.5,
      maxRepsChange: 0,
    },
    evidence: [
      {
        workoutSessionId: 'ws-1',
        localDate: '2026-08-04',
        maxWeightKg: 80,
        maxReps: 9,
        bestEstimatedOneRepMaxKg: 104,
        workingExternalVolumeKg: 2160,
        workingSetCount: 3,
        completedSetCount: 3,
        partialSetCount: 0,
        failedSetCount: 0,
        targetMinReps: 8,
        targetMaxReps: 10,
        targetWeightKg: 80,
        averageRir: null,
        averageRpe: null,
        effortCoverage: { trackedSetCount: 0, eligibleSetCount: 3 },
        reachedFailureCount: 0,
      },
    ],
    reasons: [],
    effortCoverage: { trackedSetCount: 0, eligibleSetCount: 12 },
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <PlateauAnalysisSection exerciseId="ex-1" />,
    { wrapper },
  );
}

describe('PlateauAnalysisSection (5.3)', () => {
  beforeEach(() => {
    getPlateauAnalysis.mockReset();
  });

  it('affiche loading puis NONE', async () => {
    let resolveFn: ((value: PlateauAnalysis) => void) | undefined;
    getPlateauAnalysis.mockReturnValue(
      new Promise<PlateauAnalysis>((resolve) => {
        resolveFn = resolve;
      }),
    );
    renderSection();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    resolveFn?.(baseAnalysis());
    await screen.findByText('Progression régulière');
    expect(
      screen.getByText(/Aucun signe de stagnation/i),
    ).toBeInTheDocument();
  });

  it('affiche WATCH et PLATEAU avec preuves', async () => {
    getPlateauAnalysis.mockResolvedValue(
      baseAnalysis({
        status: 'WATCH',
        reasons: ['LOAD_NOT_INCREASING', 'MAX_REPS_NOT_INCREASING'],
      }),
    );
    const { unmount } = renderSection();
    await screen.findByText('Progression à surveiller');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/workouts/ws-1');
    unmount();

    getPlateauAnalysis.mockResolvedValue(
      baseAnalysis({
        status: 'PLATEAU',
        reasons: ['LOAD_NOT_INCREASING', 'E1RM_NOT_INCREASING'],
      }),
    );
    renderSection();
    await screen.findByText('Stagnation détectée');
    expect(
      screen.getByText(/restées stables sur plusieurs séances/i),
    ).toBeInTheDocument();
  });

  it('affiche INSUFFICIENT et REVIEW', async () => {
    getPlateauAnalysis.mockResolvedValue(
      baseAnalysis({
        status: 'INSUFFICIENT_DATA',
        range: {
          analyzedWorkoutCount: 1,
          firstWorkoutDate: '2026-08-01',
          latestWorkoutDate: '2026-08-01',
        },
        evidence: [],
        reasons: ['INSUFFICIENT_WORKOUTS'],
      }),
    );
    const { unmount } = renderSection();
    await screen.findByText(/Pas encore assez de séances comparables/i);
    unmount();

    getPlateauAnalysis.mockResolvedValue(
      baseAnalysis({
        status: 'REVIEW',
        reasons: ['INCONSISTENT_TARGETS'],
      }),
    );
    renderSection();
    await screen.findByText('Analyse automatique limitée');
  });

  it('affiche une erreur réseau', async () => {
    getPlateauAnalysis.mockRejectedValue(new Error('Network Error'));
    renderSection();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i);
    });
  });
});
