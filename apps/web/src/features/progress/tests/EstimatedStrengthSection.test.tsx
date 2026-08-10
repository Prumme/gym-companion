import type {
  ExerciseProgressResponse,
  ExerciseStrengthResponse,
} from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseProgressPage } from '../pages/ExerciseProgressPage';

const getExerciseProgress = vi.fn();
const getExerciseStrength = vi.fn();

vi.mock('../api/progress-api', () => ({
  getExerciseProgress: (...args: unknown[]) => getExerciseProgress(...args),
  getExerciseStrength: (...args: unknown[]) => getExerciseStrength(...args),
}));

function emptyProgress(
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

function emptyStrength(
  overrides: Partial<ExerciseStrengthResponse> = {},
): ExerciseStrengthResponse {
  return {
    exercise: {
      id: 'exercise-1',
      name: 'Développé couché',
      archived: false,
    },
    supported: true,
    formula: 'EPLEY_V1',
    eligibility: { minReps: 1, maxReps: 12 },
    range: { from: '2026-05-10', to: '2026-08-10' },
    summary: null,
    points: [],
    ...overrides,
  };
}

function strengthPoint(
  overrides: Partial<ExerciseStrengthResponse['points'][number]> = {},
): ExerciseStrengthResponse['points'][number] {
  return {
    workoutSessionId: 'ws-1',
    workoutSessionExerciseIds: ['wse-1'],
    localDate: '2026-08-01',
    startedAt: '2026-08-01T08:00:00.000Z',
    estimatedOneRepMaxKg: 126.6666667,
    sourceSet: {
      workoutSessionExerciseId: 'wse-1',
      workoutSetId: 'set-1',
      weightKg: 100,
      reps: 8,
      rir: 1,
      rpe: null,
      reachedFailure: false,
      setType: 'WORKING',
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

describe('ExerciseProgressPage — force estimée (4.5)', () => {
  beforeEach(() => {
    getExerciseProgress.mockReset();
    getExerciseStrength.mockReset();
  });

  it('section absente pour exercice incompatible', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyProgress({
        availableMetrics: ['MAX_REPS', 'TOTAL_REPS'],
        selectedMetric: 'MAX_REPS',
      }),
    );
    getExerciseStrength.mockResolvedValue(
      emptyStrength({ supported: false, summary: null, points: [] }),
    );
    renderPage();
    await screen.findByText('Progression — Développé couché');
    expect(screen.queryByRole('heading', { name: 'Force estimée' })).not.toBeInTheDocument();
  });

  it('exercice compatible vide', async () => {
    getExerciseProgress.mockResolvedValue(emptyProgress());
    getExerciseStrength.mockResolvedValue(emptyStrength());
    renderPage();
    expect(
      await screen.findByText('Pas encore assez de données pour estimer ton 1RM.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Formule : Epley/)).toBeInTheDocument();
    expect(screen.getByText(/1 à 12 répétitions/)).toBeInTheDocument();
  });

  it('affiche latest, best, variation, série source et graphique', async () => {
    const p1 = strengthPoint({
      workoutSessionId: 'ws-1',
      localDate: '2026-07-01',
      estimatedOneRepMaxKg: 100,
      sourceSet: {
        workoutSessionExerciseId: 'wse-1',
        workoutSetId: 'a',
        weightKg: 100,
        reps: 1,
        rir: null,
        rpe: null,
        reachedFailure: false,
        setType: 'WORKING',
      },
    });
    const p2 = strengthPoint({
      workoutSessionId: 'ws-2',
      localDate: '2026-08-01',
      estimatedOneRepMaxKg: 126.6666667,
      sourceSet: {
        workoutSessionExerciseId: 'wse-2',
        workoutSetId: 'b',
        weightKg: 100,
        reps: 8,
        rir: 1,
        rpe: null,
        reachedFailure: false,
        setType: 'WORKING',
      },
    });
    getExerciseProgress.mockResolvedValue(
      emptyProgress({
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
        points: [
          {
            workoutSessionId: 'ws-2',
            workoutSessionExerciseIds: ['wse-2'],
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
          },
        ],
      }),
    );
    getExerciseStrength.mockResolvedValue(
      emptyStrength({
        points: [p1, p2],
        summary: {
          formula: 'EPLEY_V1',
          pointCount: 2,
          firstEstimatedOneRepMaxKg: 100,
          latestEstimatedOneRepMaxKg: 126.6666667,
          bestEstimatedOneRepMaxKg: 126.6666667,
          absoluteChangeKg: 26.6666667,
          percentageChange: 26.7,
          firstDate: '2026-07-01',
          latestDate: '2026-08-01',
          bestDate: '2026-08-01',
          latestSource: {
            workoutSessionId: 'ws-2',
            workoutSessionExerciseId: 'wse-2',
            workoutSetId: 'b',
            weightKg: 100,
            reps: 8,
            rir: 1,
            rpe: null,
            reachedFailure: false,
            setType: 'WORKING',
            localDate: '2026-08-01',
          },
          bestSource: {
            workoutSessionId: 'ws-2',
            workoutSessionExerciseId: 'wse-2',
            workoutSetId: 'b',
            weightKg: 100,
            reps: 8,
            rir: 1,
            rpe: null,
            reachedFailure: false,
            setType: 'WORKING',
            localDate: '2026-08-01',
          },
        },
      }),
    );

    renderPage();
    expect(
      await screen.findByText('1RM estimé actuel'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Force estimée' })).toBeInTheDocument();
    expect(screen.getByText('Meilleure estimation')).toBeInTheDocument();
    expect(screen.getByText(/Variation :/)).toBeInTheDocument();
    expect(screen.getByLabelText('Graphique du 1RM estimé')).toBeInTheDocument();
    expect(screen.getByText('Historique du 1RM estimé')).toBeInTheDocument();
    expect(screen.getByText('Charge maximale réelle')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Voir la séance' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/\/workouts\//));
  });

  it('erreur API force + exercice archivé', async () => {
    getExerciseProgress.mockResolvedValue(
      emptyProgress({ exercise: { id: 'exercise-1', name: 'Old', archived: true } }),
    );
    getExerciseStrength.mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByText('Exercice archivé')).toBeInTheDocument();
    expect(
      await screen.findByText('Impossible de charger la force estimée.'),
    ).toBeInTheDocument();
  });

  it('change de période invalide aussi la requête strength', async () => {
    getExerciseProgress.mockResolvedValue(emptyProgress());
    getExerciseStrength.mockResolvedValue(emptyStrength());
    renderPage('/progress/exercises/exercise-1?from=2026-05-10&to=2026-08-10');
    await screen.findByText('Pas encore assez de données pour estimer ton 1RM.');
    expect(getExerciseStrength).toHaveBeenCalledWith('exercise-1', {
      from: '2026-05-10',
      to: '2026-08-10',
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Période'), '30d');
    expect(getExerciseStrength).toHaveBeenCalledWith(
      'exercise-1',
      expect.objectContaining({
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('reste lisible à 320 px', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 320,
    });
    getExerciseProgress.mockResolvedValue(emptyProgress());
    getExerciseStrength.mockResolvedValue(emptyStrength());
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Force estimée' });
    expect(container.querySelector('main')?.className).toContain('max-w-3xl');
  });
});
