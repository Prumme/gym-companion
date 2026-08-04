import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveWorkoutPage } from '../pages/ActiveWorkoutPage';
import { StartWorkoutButton } from '../components/StartWorkoutButton';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const getActiveWorkoutSession = vi.fn();
const createWorkoutSession = vi.fn();
const updateWorkoutSet = vi.fn();
const getMe = vi.fn();

vi.mock('../api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  createWorkoutSession: (...args: unknown[]) => createWorkoutSession(...args),
  updateWorkoutSet: (...args: unknown[]) => updateWorkoutSet(...args),
  getWorkoutSessionDetail: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

function meResponse(mode: 'NONE' | 'RIR' | 'RPE' = 'RIR') {
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
        effortTrackingMode: mode,
        heightCm: null,
        currentWeightKg: null,
        weeklyTrainingTarget: null,
        defaultWorkoutDurationMinutes: null,
      },
    },
  };
}

describe('ActiveWorkoutPage', () => {
  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    createWorkoutSession.mockReset();
    updateWorkoutSet.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
  });

  it('affiche l’état vide sans séance active', async () => {
    getActiveWorkoutSession.mockResolvedValue(null);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workouts/active']}>
          <Routes>
            <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
            <Route path="/planning" element={<div>Planning page</div>} />
            <Route path="/programs" element={<div>Programs page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Aucune séance en cours.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Pause|Terminer|Annuler/i }),
    ).not.toBeInTheDocument();
  });

  it('affiche le snapshot et permet la saisie', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(createWorkoutSessionDetail());
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualRir: 2,
        completedAt: '2026-08-04T10:05:00.000Z',
      }),
      workoutSessionVersion: 2,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workouts/active']}>
          <ActiveWorkoutPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '0 séries enregistrées sur 1',
    );
    expect(screen.getByText(/Statut : À faire/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Pause/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Saisir$/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Charge/i)).toHaveValue(60);
    expect(within(dialog).getByLabelText(/Répétitions/i)).toHaveValue(10);

    await user.click(
      within(dialog).getByRole('button', { name: /^Enregistrer$/i }),
    );

    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 série enregistrée sur 1',
    );
  });
});

describe('StartWorkoutButton', () => {
  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    createWorkoutSession.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('demande confirmation puis crée et navigue', async () => {
    const user = userEvent.setup();
    getActiveWorkoutSession.mockResolvedValue(null);
    const created = createWorkoutSessionDetail();
    createWorkoutSession.mockImplementation(async () => {
      getActiveWorkoutSession.mockResolvedValue(created);
      return created;
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/start']}>
          <Routes>
            <Route
              path="/start"
              element={
                <StartWorkoutButton
                  sourceWorkoutTemplateId="cccccccc-cccc-cccc-cccc-cccccccccccc"
                  label="Démarrer cette séance"
                />
              }
            />
            <Route path="/workouts/active" element={<ActiveWorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: /Démarrer cette séance/i }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: /^Démarrer$/i }),
    );

    await waitFor(() =>
      expect(createWorkoutSession).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
  });
});
