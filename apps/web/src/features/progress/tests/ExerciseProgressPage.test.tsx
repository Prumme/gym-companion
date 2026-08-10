import type { ExerciseProgressResponse } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseProgressPage } from '../pages/ExerciseProgressPage';

const getExerciseProgress = vi.fn();

vi.mock('../api/progress-api', () => ({
  getExerciseProgress: (...args: unknown[]) => getExerciseProgress(...args),
}));

function emptyResponse(
  overrides: Partial<ExerciseProgressResponse> = {},
): ExerciseProgressResponse {
  return {
    exercise: {
      id: 'exercise-1',
      name: 'Développé couché',
      archived: false,
    },
    availableMetrics: [
      'MAX_WEIGHT',
      'MAX_REPS',
      'WORKING_EXTERNAL_VOLUME',
      'TOTAL_REPS',
    ],
    selectedMetric: 'MAX_WEIGHT',
    range: { from: '2026-05-10', to: '2026-08-10' },
    summary: null,
    points: [],
    ...overrides,
  };
}

function point(
  overrides: Partial<ExerciseProgressResponse['points'][number]> = {},
): ExerciseProgressResponse['points'][number] {
  return {
    workoutSessionId: 'ws-1',
    workoutSessionExerciseIds: ['wse-1'],
    localDate: '2026-08-01',
    startedAt: '2026-08-01T08:00:00.000Z',
    value: 100,
    context: {
      measurementType: 'WEIGHT_REPS',
      maxWeightKg: 100,
      maxReps: 8,
      workingExternalVolumeKg: 800,
      totalReps: 8,
      maxDurationSeconds: null,
      totalDurationSeconds: null,
      maxDistanceMeters: null,
      totalDistanceMeters: null,
      performedSetCount: 1,
      equipmentTypeId: null,
      equipmentName: null,
    },
    ...overrides,
  };
}

function renderPage(initialEntry = '/progress/exercises/exercise-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/progress/exercises/:exerciseId"
            element={<ExerciseProgressPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ExerciseProgressPage', () => {
  beforeEach(() => {
    getExerciseProgress.mockReset();
  });

  it('affiche l’état de chargement puis vide', async () => {
    getExerciseProgress.mockResolvedValue(emptyResponse());
    renderPage();
    expect(
      await screen.findByText(
        'Pas encore de données de progression pour cet exercice.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir mes programmes' })).toHaveAttribute(
      'href',
      '/programs',
    );
    expect(screen.getByRole('link', { name: 'Voir mon historique' })).toHaveAttribute(
      'href',
      '/workouts',
    );
  });

  it('affiche un point sans variation', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyResponse({
        points: [point()],
        summary: {
          metric: 'MAX_WEIGHT',
          pointCount: 1,
          firstValue: 100,
          latestValue: 100,
          bestValue: 100,
          absoluteChange: null,
          percentageChange: null,
          firstDate: '2026-08-01',
          latestDate: '2026-08-01',
          bestDate: '2026-08-01',
        },
      }),
    );
    renderPage();
    expect(
      await screen.findByText(
        'Une deuxième séance permettra de comparer ton évolution.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('100 kg')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir la séance' }),
    ).toHaveAttribute('href', '/workouts/ws-1');
  });

  it('affiche résumé, graphique et liste pour plusieurs points', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyResponse({
        points: [
          point({
            workoutSessionId: 'ws-1',
            localDate: '2026-07-01',
            startedAt: '2026-07-01T08:00:00.000Z',
            value: 90,
          }),
          point({
            workoutSessionId: 'ws-2',
            localDate: '2026-08-01',
            startedAt: '2026-08-01T08:00:00.000Z',
            value: 100,
            context: {
              measurementType: 'WEIGHT_REPS',
              maxWeightKg: 100,
              maxReps: 8,
              workingExternalVolumeKg: 800,
              totalReps: 8,
              maxDurationSeconds: null,
              totalDurationSeconds: null,
              maxDistanceMeters: null,
              totalDistanceMeters: null,
              performedSetCount: 3,
              equipmentTypeId: null,
              equipmentName: null,
            },
          }),
        ],
        summary: {
          metric: 'MAX_WEIGHT',
          pointCount: 2,
          firstValue: 90,
          latestValue: 100,
          bestValue: 100,
          absoluteChange: 10,
          percentageChange: 11.1,
          firstDate: '2026-07-01',
          latestDate: '2026-08-01',
          bestDate: '2026-08-01',
        },
      }),
    );
    renderPage();
    expect(await screen.findByText('Dernière valeur')).toBeInTheDocument();
    expect(screen.getByText('Meilleure valeur')).toBeInTheDocument();
    expect(screen.getByText(/Variation sur la période/)).toBeInTheDocument();
    expect(screen.getByLabelText('Graphique de progression')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Séances contributives' }),
    ).toBeInTheDocument();
  });

  it('change de métrique et synchronise l’URL', async () => {
    const user = userEvent.setup();
    getExerciseProgress.mockResolvedValue(emptyResponse());
    renderPage('/progress/exercises/exercise-1?metric=MAX_WEIGHT&from=2026-05-10&to=2026-08-10');
    await screen.findByText(
      'Pas encore de données de progression pour cet exercice.',
    );
    const metricSelect = screen.getByLabelText('Métrique');
    await user.selectOptions(metricSelect, 'MAX_REPS');
    expect(getExerciseProgress).toHaveBeenCalledWith(
      'exercise-1',
      expect.objectContaining({ metric: 'MAX_REPS' }),
    );
  });

  it('applique un preset 30 jours', async () => {
    const user = userEvent.setup();
    getExerciseProgress.mockResolvedValue(emptyResponse());
    renderPage();
    await screen.findByText(
      'Pas encore de données de progression pour cet exercice.',
    );
    await user.selectOptions(screen.getByLabelText('Période'), '30d');
    expect(getExerciseProgress).toHaveBeenCalledWith(
      'exercise-1',
      expect.objectContaining({
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('affiche exercice archivé et erreur API', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyResponse({
        exercise: {
          id: 'exercise-1',
          name: 'Ancien',
          archived: true,
        },
      }),
    );
    renderPage();
    expect(await screen.findByText('Exercice archivé')).toBeInTheDocument();

    getExerciseProgress.mockRejectedValue(
      Object.assign(new Error('Impossible de charger la progression.'), {
        status: 500,
      }),
    );
    renderPage('/progress/exercises/exercise-2');
    expect(
      await screen.findByText('Impossible de charger la progression.'),
    ).toBeInTheDocument();
  });

  it('reste utilisable à 320 px', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyResponse({
        points: [
          point({ workoutSessionId: 'ws-1', value: 90, localDate: '2026-07-01' }),
          point({ workoutSessionId: 'ws-2', value: 100 }),
        ],
        summary: {
          metric: 'MAX_WEIGHT',
          pointCount: 2,
          firstValue: 90,
          latestValue: 100,
          bestValue: 100,
          absoluteChange: 10,
          percentageChange: 11.1,
          firstDate: '2026-07-01',
          latestDate: '2026-08-01',
          bestDate: '2026-08-01',
        },
      }),
    );
    const { container } = renderPage();
    await screen.findByText('Dernière valeur');
    Object.defineProperty(container.firstChild, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    expect(
      within(container as HTMLElement).getByLabelText('Graphique de progression'),
    ).toBeInTheDocument();
  });
});
