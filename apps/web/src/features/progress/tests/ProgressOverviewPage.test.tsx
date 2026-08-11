import type { ProgressOverviewResponse } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressOverviewPage } from '../pages/ProgressOverviewPage';

const getProgressOverview = vi.fn();
const getMe = vi.fn();

vi.mock('../api/progress-api', async () => {
  const actual = await vi.importActual<typeof import('../api/progress-api')>(
    '../api/progress-api',
  );
  return {
    ...actual,
    getProgressOverview: (...args: unknown[]) => getProgressOverview(...args),
  };
});

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('@/features/workouts/api/workout-query-options', () => ({
  pendingTerminalLocalQueryOptions: () => ({
    queryKey: ['workouts', 'pendingTerminalLocal'],
    queryFn: async () => [],
  }),
}));

function emptyOverview(
  overrides: Partial<ProgressOverviewResponse> = {},
): ProgressOverviewResponse {
  return {
    range: { from: '2026-05-10', to: '2026-08-10' },
    availableMetrics: ['WORKOUT_COUNT'],
    selectedMetric: 'WORKOUT_COUNT',
    totals: {
      workoutCount: 0,
      exerciseCount: 0,
      uniqueExerciseCount: 0,
      performedSetCount: 0,
      totalReps: 0,
      workingExternalVolumeKg: 0,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      failureSetCount: 0,
    },
    frequency: { activeDayCount: 0, averageWorkoutsPerWeek: null },
    comparison: null,
    timeline: { bucket: 'DAY', points: [] },
    recentRecords: [],
    topExercises: [],
    ...overrides,
  };
}

function renderPage(entry = '/progress') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/progress" element={<ProgressOverviewPage />} />
          <Route path="/progress/overview" element={<ProgressOverviewPage />} />
          <Route path="/records" element={<div>Records</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProgressOverviewPage', () => {
  beforeEach(() => {
    getProgressOverview.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue({ data: { id: 'user-1' } });
  });

  it('affiche l’état vide', async () => {
    getProgressOverview.mockResolvedValue(emptyOverview());
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Pas encore assez de données' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir mes programmes' }),
    ).toBeInTheDocument();
  });

  it('affiche totaux, graphique, tops et change de période', async () => {
    const user = userEvent.setup();
    getProgressOverview.mockResolvedValue(
      emptyOverview({
        availableMetrics: [
          'WORKOUT_COUNT',
          'PERFORMED_SETS',
          'WORKING_EXTERNAL_VOLUME',
        ],
        totals: {
          workoutCount: 3,
          exerciseCount: 3,
          uniqueExerciseCount: 1,
          performedSetCount: 12,
          totalReps: 80,
          workingExternalVolumeKg: 4200,
          totalDurationSeconds: 0,
          totalDistanceMeters: 0,
          failureSetCount: 0,
        },
        frequency: { activeDayCount: 2, averageWorkoutsPerWeek: 1.5 },
        comparison: {
          workoutCountChangePercent: 50,
          performedSetCountChangePercent: 20,
          workingExternalVolumeChangePercent: null,
        },
        timeline: {
          bucket: 'DAY',
          points: [
            {
              periodStart: '2026-08-01',
              periodEnd: '2026-08-01',
              workoutCount: 1,
              performedSetCount: 4,
              totalReps: 20,
              workingExternalVolumeKg: 1000,
              totalDurationSeconds: 0,
              totalDistanceMeters: 0,
            },
            {
              periodStart: '2026-08-02',
              periodEnd: '2026-08-02',
              workoutCount: 0,
              performedSetCount: 0,
              totalReps: 0,
              workingExternalVolumeKg: 0,
              totalDurationSeconds: 0,
              totalDistanceMeters: 0,
            },
          ],
        },
        topExercises: [
          {
            exerciseId: 'ex-1',
            exerciseName: 'Développé couché',
            workoutCount: 3,
            performedSetCount: 12,
            latestPerformedOn: '2026-08-01',
          },
        ],
      }),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Progression' })).toBeInTheDocument();
    expect(
      await screen.findByText(/3 séances sur 2 jours actifs/),
    ).toBeInTheDocument();
    expect(screen.getByText('Développé couché')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Graphique de progression globale'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Développé couché/i }),
    ).toHaveAttribute('href', '/progress/exercises/ex-1');
    expect(screen.getByText('Volume')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 mois' }));
    expect(getProgressOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('sélectionne Tout → period=all et conserve le preset au refresh', async () => {
    const user = userEvent.setup();
    getProgressOverview.mockResolvedValue({
      range: { from: null, to: null },
      availableMetrics: ['WORKOUT_COUNT'],
      selectedMetric: 'WORKOUT_COUNT',
      totals: {
        workoutCount: 0,
        exerciseCount: 0,
        uniqueExerciseCount: 0,
        performedSetCount: 0,
        totalReps: 0,
        workingExternalVolumeKg: 0,
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        failureSetCount: 0,
      },
      frequency: { activeDayCount: 0, averageWorkoutsPerWeek: null },
      comparison: null,
      timeline: { bucket: 'MONTH', points: [] },
      recentRecords: [],
      topExercises: [],
    });
    renderPage('/progress?from=2026-05-10&to=2026-08-10');
    await screen.findByRole('heading', { name: 'Progression' });

    await user.click(screen.getByRole('button', { name: 'Tout' }));
    expect(getProgressOverview).toHaveBeenCalledWith(
      expect.objectContaining({ from: undefined, to: undefined }),
    );
    expect(screen.getByRole('button', { name: 'Tout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    renderPage('/progress?period=all');
    await screen.findByRole('heading', { name: 'Progression' });
    expect(screen.getByRole('button', { name: 'Tout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(getProgressOverview).toHaveBeenCalledWith(
      expect.objectContaining({ from: undefined, to: undefined }),
    );
  });

  it('affiche une erreur API', async () => {
    getProgressOverview.mockRejectedValue(
      Object.assign(new Error('Impossible de charger le dashboard de progression.'), {
        status: 500,
      }),
    );
    renderPage();
    expect(
      await screen.findByText('Impossible de charger le dashboard de progression.'),
    ).toBeInTheDocument();
  });
});
