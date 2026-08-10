import type { CoachingOverview, ExerciseCoachSummary } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachOverviewPage } from '../pages/CoachOverviewPage';
import { ExerciseCoachSummarySection } from '../components/ExerciseCoachSummarySection';

const { getCoachingOverview, getExerciseCoachSummary } = vi.hoisted(() => ({
  getCoachingOverview: vi.fn(),
  getExerciseCoachSummary: vi.fn(),
}));

vi.mock('../api/coaching-api', () => ({
  getCoachingOverview: (...args: unknown[]) => getCoachingOverview(...args),
  getExerciseCoachSummary: (...args: unknown[]) =>
    getExerciseCoachSummary(...args),
}));

function baseSummary(
  overrides: Partial<ExerciseCoachSummary> = {},
): ExerciseCoachSummary {
  return {
    exercise: {
      id: 'ex-1',
      name: 'Développé couché',
      archived: false,
      measurementType: 'WEIGHT_REPS',
    },
    supported: true,
    status: 'WATCH',
    headline: {
      title: 'Progression à surveiller',
      description:
        'Tes performances sont restées proches sur plusieurs séances récentes.',
    },
    loadRecommendation: {
      action: 'HOLD',
      currentWeightKg: 80,
      suggestedWeightKg: 80,
      reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
      workoutCount: 3,
      actionable: true,
      workoutTemplateExerciseId: 'wte-1',
      programId: 'prog-1',
    },
    plateau: {
      status: 'WATCH',
      reasons: ['LOAD_NOT_INCREASING'],
      analyzedWorkoutCount: 3,
      firstWorkoutDate: '2026-08-01',
      latestWorkoutDate: '2026-08-03',
    },
    progress: {
      maxWeightKg: { first: 80, latest: 80, change: 0 },
      maxReps: { first: 9, latest: 9, change: 0 },
      workoutCount: 3,
    },
    strength: {
      latestEstimatedOneRepMaxKg: 104,
      bestEstimatedOneRepMaxKg: 104,
      changeKg: 0,
      changePercent: 0,
    },
    recentDecision: null,
    actions: [
      {
        type: 'VIEW_LOAD_RECOMMENDATION',
        label: 'Voir la recommandation',
        href: '/programs/prog-1',
      },
      {
        type: 'VIEW_PROGRESS',
        label: 'Voir la progression',
        href: '/progress/exercises/ex-1',
      },
    ],
    notices: [],
    generatedFrom: {
      latestWorkoutDate: '2026-08-03',
      workoutCount: 3,
    },
    ...overrides,
  };
}

describe('Coach frontend (5.4)', () => {
  beforeEach(() => {
    getCoachingOverview.mockReset();
    getExerciseCoachSummary.mockReset();
  });

  it('page /coach : empty puis cartes', async () => {
    getCoachingOverview.mockResolvedValue({ items: [] } satisfies CoachingOverview);
    const emptyClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={emptyClient}>
        <MemoryRouter initialEntries={['/coach']}>
          <Routes>
            <Route path="/coach" element={<CoachOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText(/Rien à signaler/i);
    unmount();

    getCoachingOverview.mockResolvedValue({
      items: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Développé couché',
          status: 'PLATEAU',
          headline: 'Stagnation détectée',
          latestWorkoutDate: '2026-08-04',
        },
      ],
    });
    const cardsClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={cardsClient}>
        <MemoryRouter initialEntries={['/coach']}>
          <Routes>
            <Route path="/coach" element={<CoachOverviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Développé couché');
    expect(screen.getByText('Stagnation détectée')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir l’analyse/i })).toHaveAttribute(
      'href',
      '/progress/exercises/ex-1',
    );
  });

  it('section détail exercice', async () => {
    getExerciseCoachSummary.mockResolvedValue(baseSummary());
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExerciseCoachSummarySection exerciseId="ex-1" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Progression à surveiller');
    expect(screen.getByText(/Recommandation actuelle/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir la recommandation' }),
    ).toHaveAttribute('href', '/programs/prog-1');
  });

  it('erreur réseau overview', async () => {
    getCoachingOverview.mockRejectedValue(new Error('Network Error'));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CoachOverviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network Error/i);
    });
  });
});
