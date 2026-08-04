import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';
import { WorkoutSessionDetailPage } from '../pages/WorkoutSessionDetailPage';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const getActiveWorkoutSession = vi.fn();
const getWorkoutSessionDetail = vi.fn();
const pauseWorkoutSession = vi.fn();
const resumeWorkoutSession = vi.fn();
const completeWorkoutSession = vi.fn();
const cancelWorkoutSession = vi.fn();
const updateWorkoutSet = vi.fn();
const getMe = vi.fn();

vi.mock('../api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  getWorkoutSessionDetail: (...args: unknown[]) =>
    getWorkoutSessionDetail(...args),
  createWorkoutSession: vi.fn(),
  updateWorkoutSet: (...args: unknown[]) => updateWorkoutSet(...args),
  pauseWorkoutSession: (...args: unknown[]) => pauseWorkoutSession(...args),
  resumeWorkoutSession: (...args: unknown[]) => resumeWorkoutSession(...args),
  completeWorkoutSession: (...args: unknown[]) =>
    completeWorkoutSession(...args),
  cancelWorkoutSession: (...args: unknown[]) => cancelWorkoutSession(...args),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

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
    },
  };
}

function renderActive(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workouts/active']}>
        <Routes>
          <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
          <Route
            path="/workouts/:workoutSessionId"
            element={<WorkoutSessionDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('Workout lifecycle UI (3.3)', () => {
  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    getWorkoutSessionDetail.mockReset();
    pauseWorkoutSession.mockReset();
    resumeWorkoutSession.mockReset();
    completeWorkoutSession.mockReset();
    cancelWorkoutSession.mockReset();
    updateWorkoutSet.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('affiche les actions ACTIVE et met en pause', async () => {
    const user = userEvent.setup();
    const active = createWorkoutSessionDetail();
    getActiveWorkoutSession.mockResolvedValue(active);
    pauseWorkoutSession.mockResolvedValue({
      workoutSession: createWorkoutSessionDetail({
        status: 'PAUSED',
        pausedAt: '2026-08-04T10:10:00.000Z',
        version: 2,
        permissions: {
          canPause: false,
          canResume: true,
          canComplete: true,
          canCancel: true,
          canRecordSets: false,
        },
      }),
      workoutSessionVersion: 2,
    });

    renderActive();
    expect(await screen.findByRole('button', { name: /Mettre en pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Terminer la séance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler la séance/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reprendre/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mettre en pause/i }));
    await waitFor(() => expect(pauseWorkoutSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Statut : En pause/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Saisie des séries désactivée pendant la pause/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Saisir$/i })).not.toBeInTheDocument();
  });

  it('reprend une séance en pause', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(
      createWorkoutSessionDetail({
        status: 'PAUSED',
        pausedAt: '2026-08-04T10:10:00.000Z',
        version: 2,
        permissions: {
          canPause: false,
          canResume: true,
          canComplete: true,
          canCancel: true,
          canRecordSets: false,
        },
      }),
    );
    resumeWorkoutSession.mockResolvedValue({
      workoutSession: createWorkoutSessionDetail({ version: 3 }),
      workoutSessionVersion: 3,
    });

    renderActive();
    await user.click(
      await screen.findByRole('button', { name: /Reprendre la séance/i }),
    );
    await waitFor(() => expect(resumeWorkoutSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Statut : En cours/i)).toBeInTheDocument();
  });

  it('termine avec avertissement de séries restantes et navigue', async () => {
    const user = userEvent.setup();
    const active = createWorkoutSessionDetail({
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
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({ id: 'ws-1', status: 'PENDING' }),
            createWorkoutSet({ id: 'ws-2', position: 1, status: 'PENDING' }),
          ],
        },
      ],
    });
    getActiveWorkoutSession.mockResolvedValue(active);
    const completed = createWorkoutSessionDetail({
      status: 'COMPLETED',
      completedAt: '2026-08-04T11:00:00.000Z',
      notes: 'Fin',
      version: 2,
      permissions: {
        canPause: false,
        canResume: false,
        canComplete: false,
        canCancel: false,
        canRecordSets: false,
      },
    });
    completeWorkoutSession.mockResolvedValue({
      workoutSession: completed,
      workoutSessionVersion: 2,
    });
    getWorkoutSessionDetail.mockResolvedValue(completed);
    getActiveWorkoutSession
      .mockResolvedValueOnce(active)
      .mockResolvedValue(null);

    const client = renderActive();
    await user.click(
      await screen.findByRole('button', { name: /Terminer la séance/i }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Certaines séries sont encore à faire/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Aucune série n’a encore été enregistrée/i),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Notes/i), 'Fin');
    await user.click(
      within(dialog).getByRole('button', { name: /Terminer quand même/i }),
    );

    await waitFor(() => expect(completeWorkoutSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Statut : Terminée/i)).toBeInTheDocument();
    expect(client.getQueryData(['workouts', 'active'])).toBeNull();
  });

  it('annule avec motif et conserve l’affichage lecture seule', async () => {
    const user = userEvent.setup();
    const active = createWorkoutSessionDetail({
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
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({
              status: 'COMPLETED',
              actualWeightKg: 60,
              actualReps: 10,
            }),
          ],
        },
      ],
    });
    getActiveWorkoutSession.mockResolvedValue(active);
    const cancelled = createWorkoutSessionDetail({
      status: 'CANCELLED',
      cancelledAt: '2026-08-04T11:00:00.000Z',
      cancellationReason: 'Fatigue',
      version: 2,
      permissions: {
        canPause: false,
        canResume: false,
        canComplete: false,
        canCancel: false,
        canRecordSets: false,
      },
      exercises: active.exercises,
    });
    cancelWorkoutSession.mockResolvedValue({
      workoutSession: cancelled,
      workoutSessionVersion: 2,
    });
    getWorkoutSessionDetail.mockResolvedValue(cancelled);

    renderActive();
    await user.click(
      await screen.findByRole('button', { name: /^Annuler la séance$/i }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/Motif/i), 'Fatigue');
    await user.click(
      within(dialog).getByRole('button', { name: /^Annuler la séance$/i }),
    );

    await waitFor(() => expect(cancelWorkoutSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Statut : Annulée/i)).toBeInTheDocument();
    expect(screen.getByText(/Fatigue/i)).toBeInTheDocument();
    expect(screen.getByText(/Réalisé :/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Mettre en pause|Terminer|Reprendre/i }),
    ).not.toBeInTheDocument();
  });

  it('signale un conflit de version sans resoumettre', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(createWorkoutSessionDetail());
    pauseWorkoutSession.mockRejectedValue(
      Object.assign(new Error('conflict'), {
        code: 'WORKOUT_VERSION_CONFLICT',
        status: 409,
      }),
    );

    renderActive();
    await user.click(
      await screen.findByRole('button', { name: /Mettre en pause/i }),
    );
    expect(
      await screen.findByText(
        /La séance a été modifiée depuis un autre onglet ou appareil/i,
      ),
    ).toBeInTheDocument();
  });
});
