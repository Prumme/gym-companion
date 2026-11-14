import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const addWorkoutSessionWarmupSets = vi.fn();

vi.mock('../api/workout-api', async () => {
  const actual = await vi.importActual<typeof import('../api/workout-api')>('../api/workout-api');
  return {
    ...actual,
    addWorkoutSessionWarmupSets: (...args: unknown[]) => addWorkoutSessionWarmupSets(...args),
    addWorkoutSessionSet: vi.fn(),
    deleteWorkoutSessionSet: vi.fn(),
    addWorkoutSessionExercise: vi.fn(),
    replaceWorkoutSessionExercise: vi.fn(),
  };
});

vi.mock('@/features/exercises/api/exercise-api', () => ({
  listExercises: vi.fn().mockResolvedValue({
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  }),
  getExercise: vi.fn(),
  listMuscleGroups: vi.fn().mockResolvedValue([]),
  listEquipmentTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../offline/store', () => ({
  persistServerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function renderPanel(options: { browserOffline?: boolean; onVersionConflict?: () => void } = {}) {
  const session = createWorkoutSessionDetail({
    status: 'ACTIVE',
    version: 5,
    exercises: [
      {
        id: 'se-squat',
        position: 0,
        sourceExerciseId: 'ex-squat',
        exerciseName: 'Squat',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Quadriceps',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: 'eq-bar', code: 'barbell', name: 'Barre' },
        notes: null,
        restSeconds: 120,
        sets: [
          createWorkoutSet({
            id: 'ws-1',
            status: 'PENDING',
            setType: 'WORKING',
            targetWeightKg: 100,
            targetRepMin: 5,
            targetRepMax: 5,
          }),
        ],
      },
    ],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], { data: { id: 'u1' } });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ActiveExercisePanel
          session={session}
          exercise={session.exercises[0]!}
          effortTrackingMode="RIR"
          canRecordSets
          nextPendingSetId="ws-1"
          exerciseIndex={0}
          totalExercises={1}
          hasNextExercise={false}
          onVersionConflict={options.onVersionConflict ?? vi.fn()}
          onSetRecorded={vi.fn()}
          browserOffline={options.browserOffline ?? false}
          loadCuesReady
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return session;
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Actions de l’exercice' }));
  await user.click(screen.getByRole('menuitem', { name: /Disques et échauffement/i }));
}

describe('Ajouter les séries d’échauffement (calculateur de disques)', () => {
  beforeEach(() => {
    addWorkoutSessionWarmupSets.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('envoie la rampe calculée puis ferme la feuille avec un message', async () => {
    const user = userEvent.setup();
    const session = renderPanel();
    addWorkoutSessionWarmupSets.mockResolvedValue({ ...session, version: 6 });

    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'Ajouter ces séries d’échauffement' }));

    await waitFor(() => {
      expect(addWorkoutSessionWarmupSets).toHaveBeenCalledWith(
        session.id,
        'se-squat',
        expect.objectContaining({
          expectedVersion: 5,
          clientCommandId: expect.any(String),
          sets: [
            { targetWeightKg: 20, targetReps: 10 },
            { targetWeightKg: 40, targetReps: 5 },
            { targetWeightKg: 60, targetReps: 3 },
            { targetWeightKg: 80, targetReps: 1 },
          ],
        }),
      );
    });
    expect(await screen.findByText('4 séries d’échauffement ajoutées.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('désactive l’action hors ligne et explique pourquoi', async () => {
    const user = userEvent.setup();
    renderPanel({ browserOffline: true });

    await openSheet(user);
    const button = screen.getByRole('button', { name: 'Ajouter ces séries d’échauffement' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      'Connexion nécessaire pour ajouter les séries d’échauffement.',
    );
    expect(addWorkoutSessionWarmupSets).not.toHaveBeenCalled();
  });

  it('signale un conflit de version', async () => {
    const user = userEvent.setup();
    const onVersionConflict = vi.fn();
    renderPanel({ onVersionConflict });
    addWorkoutSessionWarmupSets.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, code: 'WORKOUT_VERSION_CONFLICT' }),
    );

    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'Ajouter ces séries d’échauffement' }));

    await waitFor(() => expect(onVersionConflict).toHaveBeenCalledTimes(1));
  });
});
