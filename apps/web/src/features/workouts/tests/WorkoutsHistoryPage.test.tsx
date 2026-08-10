import type { WorkoutHistoryListItem } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkoutsHistoryPage } from '../pages/WorkoutsHistoryPage';
import { WorkoutSessionDetailPage } from '../pages/WorkoutSessionDetailPage';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const listWorkoutHistory = vi.fn();
const getWorkoutSessionDetail = vi.fn();
const getMe = vi.fn();

vi.mock('../api/workout-api', () => ({
  listWorkoutHistory: (...args: unknown[]) => listWorkoutHistory(...args),
  getWorkoutSessionDetail: (...args: unknown[]) =>
    getWorkoutSessionDetail(...args),
  getActiveWorkoutSession: vi.fn(),
  createWorkoutSession: vi.fn(),
  updateWorkoutSet: vi.fn(),
  pauseWorkoutSession: vi.fn(),
  resumeWorkoutSession: vi.fn(),
  completeWorkoutSession: vi.fn(),
  cancelWorkoutSession: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('../offline/store', async () => {
  const actual = await vi.importActual<typeof import('../offline/store')>(
    '../offline/store',
  );
  return {
    ...actual,
    listPendingTerminalSnapshots: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue(null),
    persistServerSnapshot: vi.fn().mockResolvedValue(null),
  };
});

function meResponse() {
  return {
    data: {
      id: 'u1',
      email: 'a@example.com',
      status: 'ACTIVE',
      role: 'USER',
      profile: {
        displayName: 'A',
        timezone: 'Europe/Paris',
        weightUnit: 'KG',
        distanceUnit: 'KM',
        primaryGoal: 'HYPERTROPHY',
        experienceLevel: 'INTERMEDIATE',
        effortTrackingMode: 'RIR',
        heightCm: null,
        currentWeightKg: null,
        weeklyTrainingTarget: null,
        defaultWorkoutDurationMinutes: null,
      },
      ai: { available: false },
    },
  };
}

function historyItem(
  overrides: Partial<WorkoutHistoryListItem> = {},
): WorkoutHistoryListItem {
  return {
    id: 'hist-1',
    name: 'Séance Push',
    status: 'COMPLETED',
    localDate: '2026-08-03',
    timezone: 'Europe/Paris',
    startedAt: '2026-08-03T08:00:00.000Z',
    completedAt: '2026-08-03T09:00:00.000Z',
    cancelledAt: null,
    source: {
      programId: 'p1',
      programName: 'PPL',
      workoutTemplateId: 't1',
      workoutTemplateName: 'Push A',
    },
    summary: {
      exerciseCount: 1,
      totalSetCount: 3,
      processedSetCount: 2,
      completedSetCount: 1,
      partialSetCount: 1,
      failedSetCount: 0,
      skippedSetCount: 0,
      pendingSetCount: 1,
    },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderHistory(initialEntry = '/workouts') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/workouts" element={<WorkoutsHistoryPage />} />
          <Route
            path="/workouts/:workoutSessionId"
            element={<WorkoutSessionDetailPage />}
          />
          <Route path="/workouts/active" element={<div>Active page</div>} />
          <Route path="/planning" element={<div>Planning page</div>} />
          <Route path="/programs" element={<div>Programs page</div>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkoutsHistoryPage', () => {
  beforeEach(() => {
    listWorkoutHistory.mockReset();
    getWorkoutSessionDetail.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
  });

  it('affiche reps et volume sur une carte COMPLETED', async () => {
    listWorkoutHistory.mockResolvedValue({
      data: [
        historyItem({
          summary: {
            exerciseCount: 4,
            totalSetCount: 14,
            processedSetCount: 14,
            completedSetCount: 14,
            partialSetCount: 0,
            failedSetCount: 0,
            skippedSetCount: 0,
            pendingSetCount: 0,
            totalReps: 112,
            workingExternalVolumeKg: 5480,
          },
        }),
        historyItem({
          id: 'cancelled-1',
          name: 'Séance annulée',
          status: 'CANCELLED',
          summary: {
            exerciseCount: 1,
            totalSetCount: 3,
            processedSetCount: 1,
            completedSetCount: 1,
            partialSetCount: 0,
            failedSetCount: 0,
            skippedSetCount: 0,
            pendingSetCount: 2,
          },
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderHistory();
    expect(await screen.findByText(/112 répétitions/)).toBeInTheDocument();
    expect(screen.getByText(/kg·rep/)).toBeInTheDocument();
    expect(screen.getByText('Séance annulée')).toBeInTheDocument();
    expect(screen.queryAllByText(/kg·rep/)).toHaveLength(1);
  });

  it('affiche l’état vide', async () => {
    listWorkoutHistory.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderHistory();
    expect(
      await screen.findByText('Aucune séance terminée ou annulée.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /planning/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /programmes/i }),
    ).toBeInTheDocument();
  });

  it('affiche les cartes terminées et annulées', async () => {
    listWorkoutHistory.mockResolvedValue({
      data: [
        historyItem(),
        historyItem({
          id: 'hist-2',
          name: 'Séance annulée',
          status: 'CANCELLED',
          completedAt: null,
          cancelledAt: '2026-08-02T10:00:00.000Z',
          localDate: '2026-08-02',
        }),
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderHistory();
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    expect(screen.getByText('Séance annulée')).toBeInTheDocument();
    expect(screen.getByText('Terminée')).toBeInTheDocument();
    expect(screen.getByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText(/2 séances chargées/)).toBeInTheDocument();
  });

  it('synchronise les filtres dans l’URL', async () => {
    const user = userEvent.setup();
    listWorkoutHistory.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
    renderHistory();
    await screen.findByText('Aucune séance terminée ou annulée.');

    const statusSelect = screen.getByLabelText('Filtrer par statut');
    await user.selectOptions(statusSelect, 'COMPLETED');

    await waitFor(() => {
      expect(listWorkoutHistory).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'COMPLETED', limit: 20 }),
      );
    });
  });

  it('pagine avec Charger plus et conserve les pages', async () => {
    const user = userEvent.setup();
    listWorkoutHistory
      .mockResolvedValueOnce({
        data: [historyItem({ id: 'p1', name: 'Page 1' })],
        pagination: { nextCursor: 'cursor-1', hasMore: true },
      })
      .mockResolvedValueOnce({
        data: [historyItem({ id: 'p2', name: 'Page 2' })],
        pagination: { nextCursor: null, hasMore: false },
      });
    renderHistory();
    expect(await screen.findByText('Page 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
  });

  it('conserve les pages déjà chargées si la page suivante échoue', async () => {
    const user = userEvent.setup();
    listWorkoutHistory
      .mockResolvedValueOnce({
        data: [historyItem({ id: 'p1', name: 'Conservée' })],
        pagination: { nextCursor: 'cursor-1', hasMore: true },
      })
      .mockRejectedValueOnce(new Error('network'));
    renderHistory();
    expect(await screen.findByText('Conservée')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Conservée')).toBeInTheDocument();
  });

  it('navigue vers le détail en conservant les filtres au retour', async () => {
    const user = userEvent.setup();
    listWorkoutHistory.mockResolvedValue({
      data: [historyItem()],
      pagination: { nextCursor: null, hasMore: false },
    });
    getWorkoutSessionDetail.mockResolvedValue(
      createWorkoutSessionDetail({
        id: 'hist-1',
        status: 'COMPLETED',
        completedAt: '2026-08-03T09:00:00.000Z',
        permissions: {
          canPause: false,
          canResume: false,
          canComplete: false,
          canCancel: false,
          canRecordSets: false,
        },
        metrics: {
          exerciseCount: 1,
          performedExerciseCount: 1,
          sets: {
            total: 1,
            processed: 1,
            performed: 1,
            completed: 1,
            partial: 0,
            failed: 0,
            skipped: 0,
            pending: 0,
            cancelled: 0,
            warmup: 0,
            working: 1,
            reachedFailure: 0,
          },
          performance: {
            totalReps: 10,
            totalExternalVolumeKg: 600,
            workingExternalVolumeKg: 600,
            totalDurationSeconds: 0,
            totalDistanceMeters: 0,
          },
          elapsedDurationSeconds: 3600,
        },
      }),
    );
    renderHistory('/workouts?status=COMPLETED');
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: /Ouvrir la séance Séance Push/i }),
    );
    expect(await screen.findByText('Progression finale')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Résumé de la séance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('10 répétitions')).toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: /Retour à l’historique/i }),
    );
    expect(await screen.findByText('Historique')).toBeInTheDocument();
    expect(listWorkoutHistory).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });
});

describe('WorkoutSessionDetailPage historique', () => {
  beforeEach(() => {
    listWorkoutHistory.mockReset();
    getWorkoutSessionDetail.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
  });

  function renderDetail(id: string) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/workouts/${id}`]}>
          <Routes>
            <Route
              path="/workouts/:workoutSessionId"
              element={<WorkoutSessionDetailPage />}
            />
            <Route path="/workouts/active" element={<div>Active page</div>} />
            <Route path="/workouts" element={<div>History page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('affiche une séance terminée en lecture seule', async () => {
    getWorkoutSessionDetail.mockResolvedValue(
      createWorkoutSessionDetail({
        id: 'hist-1',
        status: 'COMPLETED',
        completedAt: '2026-08-04T11:00:00.000Z',
        notes: 'Bonne séance',
        permissions: {
          canPause: false,
          canResume: false,
          canComplete: false,
          canCancel: false,
          canRecordSets: false,
        },
        exercises: [
          {
            id: 'wse-1',
            position: 0,
            sourceExerciseId: 'ex-1',
            exerciseName: 'Développé couché',
            measurementType: 'WEIGHT_REPS',
            primaryMuscleGroupName: 'Pectoraux',
            sourceExerciseArchivedAtCreation: false,
            equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
            notes: 'Contrôle',
            restSeconds: 90,
            sets: [
              createWorkoutSet({
                status: 'COMPLETED',
                actualReps: 10,
                actualWeightKg: 60,
                actualRir: 1,
                reachedFailure: true,
                completedAt: '2026-08-04T10:20:00.000Z',
              }),
              createWorkoutSet({
                id: 'ws-2',
                position: 1,
                status: 'PENDING',
              }),
              createWorkoutSet({
                id: 'ws-3',
                position: 2,
                status: 'SKIPPED',
              }),
            ],
          },
        ],
      }),
    );
    renderDetail('hist-1');
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Statut : Terminée/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Notes :/)).toBeInTheDocument();
    expect(screen.getByText('Bonne séance')).toBeInTheDocument();
    expect(screen.getByText('Durée écoulée :')).toBeInTheDocument();
    expect(screen.getByText(/Non réalisée/)).toBeInTheDocument();
    expect(screen.getByText(/Échec musculaire : Oui/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Saisir/i })).toBeNull();
  });

  it('affiche une séance annulée avec motif', async () => {
    getWorkoutSessionDetail.mockResolvedValue(
      createWorkoutSessionDetail({
        status: 'CANCELLED',
        cancelledAt: '2026-08-04T10:30:00.000Z',
        cancellationReason: 'Douleur',
        completedAt: null,
        permissions: {
          canPause: false,
          canResume: false,
          canComplete: false,
          canCancel: false,
          canRecordSets: false,
        },
      }),
    );
    renderDetail('hist-1');
    expect(await screen.findByText(/Statut : Annulée/)).toBeInTheDocument();
    expect(screen.getByText('Douleur')).toBeInTheDocument();
  });

  it('redirige une séance active vers /workouts/active', async () => {
    getWorkoutSessionDetail.mockResolvedValue(
      createWorkoutSessionDetail({ status: 'ACTIVE' }),
    );
    renderDetail('hist-1');
    expect(await screen.findByText('Active page')).toBeInTheDocument();
  });

  it('affiche une erreur 404', async () => {
    getWorkoutSessionDetail.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );
    renderDetail('missing');
    expect(await screen.findByText('Séance introuvable.')).toBeInTheDocument();
  });
});
