import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  replaceWorkoutSessionExercise: vi.fn(),
  getWorkoutSessionDetail: vi.fn(),
  pauseWorkoutSession: vi.fn(),
  resumeWorkoutSession: vi.fn(),
  completeWorkoutSession: vi.fn(),
  cancelWorkoutSession: vi.fn(),
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
      ai: { available: false },
    },
  };
}

describe('ActiveWorkoutPage', () => {
  let wakeLockRequest: ReturnType<typeof vi.fn>;
  let wakeLockRelease: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getActiveWorkoutSession.mockReset();
    createWorkoutSession.mockReset();
    updateWorkoutSet.mockReset();
    getMe.mockReset();
    getMe.mockResolvedValue(meResponse());

    wakeLockRelease = vi.fn(async () => undefined);
    wakeLockRequest = vi.fn(async () => ({
      released: false,
      release: wakeLockRelease,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      wakeLock: { request: wakeLockRequest },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(wakeLockRequest).not.toHaveBeenCalled();
  });

  it('demande un screen wake lock quand une séance ACTIVE est affichée', async () => {
    getActiveWorkoutSession.mockResolvedValue(createWorkoutSessionDetail());
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workouts/active']}>
          <ActiveWorkoutPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Séance Push')).toBeInTheDocument();
    await waitFor(() => {
      expect(wakeLockRequest).toHaveBeenCalledWith('screen');
    });

    unmount();
    await waitFor(() => {
      expect(wakeLockRelease).toHaveBeenCalled();
    });
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
    expect(screen.getByText(/0 \/ 1 séries/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Développé couché' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Courante')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: /principale/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Actions de séance/i }));
    expect(
      screen.getByRole('menuitem', { name: /Mettre en pause/i }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(
      screen.getByRole('button', { name: /Enregistrer la série/i }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Charge/i)).toHaveValue(60);
    expect(within(dialog).getByLabelText(/Répétitions/i)).toHaveValue(10);

    await user.click(
      within(dialog).getByRole('button', { name: /^Enregistrer$/i }),
    );

    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 1 séries/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Terminer la séance$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Exercice terminé/i)).toBeInTheDocument();
  });

  it('démarre le repos après une série intermédiaire', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const session = createWorkoutSessionDetail({
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
              id: 'ws-1',
              status: 'PENDING',
              targetRestSeconds: 90,
            }),
            createWorkoutSet({
              id: 'ws-2',
              position: 1,
              status: 'PENDING',
              targetRestSeconds: 90,
            }),
          ],
        },
      ],
    });
    getActiveWorkoutSession.mockResolvedValue(session);
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        id: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualRir: 2,
        targetRestSeconds: 90,
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

    await user.click(
      await screen.findByRole('button', { name: /Enregistrer la série/i }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /^Enregistrer$/i,
      }),
    );
    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Terminer la séance$/i }),
    ).not.toBeInTheDocument();
    const shell = document.querySelector('[data-rest-timer-active="true"]');
    expect(shell).not.toBeNull();
    expect(shell?.className).not.toMatch(/\bpb-56\b|\bpb-60\b/);
    expect(
      document.querySelector('[data-rest-timer-padding="true"]'),
    ).toBeNull();
  });

  it('navigue entre exercices et démarre la minuterie après enregistrement', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const session = createWorkoutSessionDetail({
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
              id: 'ws-1',
              status: 'PENDING',
              targetRestSeconds: 90,
            }),
          ],
        },
        {
          id: 'wse-2',
          position: 1,
          sourceExerciseId: 'ex-2',
          exerciseName: 'Élévations latérales',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Épaules',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-2', code: 'dumbbell', name: 'Haltères' },
          notes: null,
          restSeconds: 60,
          sets: [createWorkoutSet({ id: 'ws-2', status: 'PENDING' })],
        },
      ],
    });
    getActiveWorkoutSession.mockResolvedValue(session);
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        id: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: 60,
        actualReps: 10,
        actualRir: 2,
        targetRestSeconds: 90,
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

    expect(await screen.findByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Aller à l'exercice suivant/i }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Élévations latérales' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Aller à l'exercice précédent/i }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Développé couché' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Enregistrer la série/i }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: /^Enregistrer$/i }),
    );
    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    expect(screen.getByText(/Exercice terminé/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Exercice suivant$/i }),
    ).toBeInTheDocument();
    const shell = document.querySelector('[data-rest-timer-active="true"]');
    expect(shell).not.toBeNull();
    expect(shell?.className).not.toMatch(/\bpb-56\b|\bpb-60\b/);
  });

  it('priorise Terminer la séance après la dernière série du dernier exercice', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const session = createWorkoutSessionDetail({
      exercises: [
        {
          id: 'wse-1',
          position: 0,
          sourceExerciseId: 'ex-1',
          exerciseName: 'Tractions',
          measurementType: 'BODYWEIGHT_REPS',
          primaryMuscleGroupName: 'Dos',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-1', code: 'bodyweight', name: 'Poids du corps' },
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({
              id: 'ws-1',
              status: 'PENDING',
              targetWeightKg: null,
              targetRestSeconds: 90,
            }),
          ],
        },
      ],
    });
    getActiveWorkoutSession.mockResolvedValue(session);
    updateWorkoutSet.mockResolvedValue({
      workoutSet: createWorkoutSet({
        id: 'ws-1',
        status: 'COMPLETED',
        actualWeightKg: null,
        actualReps: 10,
        actualRir: 2,
        targetWeightKg: null,
        targetRestSeconds: 90,
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

    await user.click(
      await screen.findByRole('button', { name: /Enregistrer la série/i }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: /^Enregistrer$/i,
      }),
    );
    await waitFor(() => expect(updateWorkoutSet).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText(/^Exercice terminé$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Terminer la séance$/i }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-rest-timer-active="false"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-rest-timer-active="true"]'),
    ).toBeNull();

    await user.click(
      screen.getByRole('button', { name: /^Terminer la séance$/i }),
    );
    const completeDialog = await screen.findByRole('dialog');
    expect(
      within(completeDialog).getByText(/Terminer la séance \?/i),
    ).toBeInTheDocument();
    expect(within(completeDialog).getByLabelText(/Notes/i)).toHaveAttribute(
      'rows',
      '1',
    );
    expect(
      within(completeDialog).getByRole('button', {
        name: /Continuer la séance/i,
      }),
    ).toBeInTheDocument();
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
