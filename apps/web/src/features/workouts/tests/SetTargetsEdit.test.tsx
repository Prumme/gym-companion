import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const updateWorkoutSetTargets = vi.fn();

vi.mock('../api/workout-api', async () => {
  const actual = await vi.importActual<typeof import('../api/workout-api')>('../api/workout-api');
  return {
    ...actual,
    updateWorkoutSetTargets: (...args: unknown[]) => updateWorkoutSetTargets(...args),
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

function renderPanel(options: { onVersionConflict?: () => void } = {}) {
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
            targetRestSeconds: 180,
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
          loadCuesReady
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return session;
}

async function openTargets(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Série 1,/ }));
  await user.click(screen.getByRole('button', { name: 'Modifier la cible' }));
  return screen.getByRole('dialog', { name: 'Modifier la cible' });
}

describe('Modifier la cible d’une série pendant la séance', () => {
  beforeEach(() => {
    updateWorkoutSetTargets.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('envoie uniquement la cible modifiée et confirme', async () => {
    const user = userEvent.setup();
    const session = renderPanel();
    updateWorkoutSetTargets.mockImplementation(async () => ({
      workoutSet: { ...session.exercises[0]!.sets[0]!, targetWeightKg: 102.5 },
      workoutSessionVersion: 6,
    }));

    const dialog = await openTargets(user);
    expect(dialog).toHaveAccessibleDescription(
      'Change uniquement cette séance : le programme reste tel quel.',
    );
    const weight = screen.getByLabelText('Charge cible (kg)');
    expect(weight).toHaveValue('100');
    await user.clear(weight);
    await user.type(weight, '102,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la cible' }));

    await waitFor(() => {
      expect(updateWorkoutSetTargets).toHaveBeenCalledWith(session.id, 'se-squat', 'ws-1', {
        targetWeightKg: 102.5,
        expectedVersion: 5,
        clientCommandId: expect.any(String),
      });
    });
    expect(await screen.findByText('Cible modifiée pour cette séance.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('signale localement une saisie invalide sans appeler l’API', async () => {
    const user = userEvent.setup();
    renderPanel();

    await openTargets(user);
    await user.clear(screen.getByLabelText('Reps min'));
    await user.type(screen.getByLabelText('Reps min'), '9');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la cible' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le minimum de répétitions dépasse le maximum.',
    );
    expect(updateWorkoutSetTargets).not.toHaveBeenCalled();
  });

  it('signale un conflit de version', async () => {
    const user = userEvent.setup();
    const onVersionConflict = vi.fn();
    renderPanel({ onVersionConflict });
    updateWorkoutSetTargets.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, code: 'WORKOUT_VERSION_CONFLICT' }),
    );

    await openTargets(user);
    await user.clear(screen.getByLabelText('Repos après la série (s)'));
    await user.type(screen.getByLabelText('Repos après la série (s)'), '150');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la cible' }));

    await waitFor(() => expect(onVersionConflict).toHaveBeenCalledTimes(1));
  });
});
