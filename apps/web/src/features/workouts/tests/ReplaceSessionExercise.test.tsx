import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const replaceWorkoutSessionExercise = vi.fn();
const listExercises = vi.fn();
const getExercise = vi.fn();

vi.mock('../api/workout-api', async () => {
  const actual = await vi.importActual<typeof import('../api/workout-api')>(
    '../api/workout-api',
  );
  return {
    ...actual,
    replaceWorkoutSessionExercise: (...args: unknown[]) =>
      replaceWorkoutSessionExercise(...args),
  };
});

vi.mock('@/features/exercises/api/exercise-api', () => ({
  listExercises: (...args: unknown[]) => listExercises(...args),
  getExercise: (...args: unknown[]) => getExercise(...args),
  listMuscleGroups: vi.fn().mockResolvedValue([]),
  listEquipmentTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../offline/store', () => ({
  persistServerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function renderPanel(
  overrides: Partial<Parameters<typeof ActiveExercisePanel>[0]> = {},
) {
  const session = createWorkoutSessionDetail({
    status: 'ACTIVE',
    version: 3,
    exercises: [
      {
        id: 'se-1',
        position: 0,
        sourceExerciseId: 'ex-press',
        exerciseName: 'Presse à cuisses',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Quadriceps',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: null, code: null, name: 'Machine' },
        notes: null,
        restSeconds: 90,
        sets: [
          createWorkoutSet({ id: 'ws-1', status: 'PENDING' }),
          createWorkoutSet({ id: 'ws-2', position: 1, status: 'PENDING' }),
        ],
      },
    ],
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], { data: { id: 'u1' } });

  const exercise = session.exercises[0]!;

  return {
    session,
    exercise,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ActiveExercisePanel
          session={session}
          exercise={exercise}
          effortTrackingMode="RIR"
          canRecordSets
          nextPendingSetId="ws-1"
          exerciseIndex={0}
          totalExercises={1}
          hasNextExercise={false}
          onVersionConflict={vi.fn()}
          onSetRecorded={vi.fn()}
          {...overrides}
        />
      </QueryClientProvider>,
    ),
  };
}

describe('Replace session exercise UI', () => {
  beforeEach(() => {
    replaceWorkoutSessionExercise.mockReset();
    listExercises.mockReset();
    getExercise.mockReset();

    getExercise.mockResolvedValue({
      id: 'ex-press',
      name: 'Presse à cuisses',
      measurementType: 'WEIGHT_REPS',
      primaryMuscleGroup: { id: 'mg-quad', name: 'Quadriceps', code: 'QUADS' },
      secondaryMuscleGroups: [],
      defaultEquipmentType: {
        id: 'eq-1',
        name: 'Machine',
        code: 'MACHINE',
      },
      compatibleEquipmentTypes: [],
      defaultRestSeconds: 90,
      instructions: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      source: 'SYSTEM',
      permissions: { canEdit: false, canArchive: false, canRestore: false },
      userPreference: {
        isFavorite: false,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      },
    });

    listExercises.mockResolvedValue({
      data: [
        {
          id: 'ex-hack',
          source: 'SYSTEM',
          name: 'Hack Squat',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroup: {
            id: 'mg-quad',
            name: 'Quadriceps',
            code: 'QUADS',
          },
          defaultEquipmentType: {
            id: 'eq-1',
            name: 'Machine',
            code: 'MACHINE',
          },
          defaultRestSeconds: 90,
          archivedAt: null,
          permissions: { canEdit: false, canArchive: false, canRestore: false },
          userPreference: {
            isFavorite: false,
            isExcludedFromSuggestions: false,
            preferredEquipmentTypeId: null,
            restSecondsOverride: null,
          },
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ouvre le sheet depuis le menu et remplace l’exercice', async () => {
    const user = userEvent.setup();
    const updated = createWorkoutSessionDetail({
      status: 'ACTIVE',
      version: 4,
      exercises: [
        {
          id: 'se-1',
          position: 0,
          sourceExerciseId: 'ex-hack',
          exerciseName: 'Hack Squat',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Quadriceps',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: null, code: null, name: 'Machine' },
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({ id: 'ws-1', status: 'PENDING' }),
            createWorkoutSet({ id: 'ws-2', position: 1, status: 'PENDING' }),
          ],
        },
      ],
    });
    replaceWorkoutSessionExercise.mockResolvedValue(updated);

    renderPanel();

    await user.click(
      screen.getByRole('button', { name: 'Actions de l’exercice' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Remplacer l’exercice' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: 'Remplacer Presse à cuisses',
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(listExercises).toHaveBeenCalled();
    });

    const hackButtons = within(dialog).getAllByRole('button', {
      name: /Hack Squat/i,
    });
    await user.click(hackButtons[0]!);
    await user.click(within(dialog).getByRole('button', { name: 'Remplacer' }));

    await waitFor(() => {
      expect(replaceWorkoutSessionExercise).toHaveBeenCalledWith(
        expect.any(String),
        'se-1',
        { exerciseId: 'ex-hack', expectedVersion: 3 },
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Exercice remplacé')).toBeInTheDocument();
    });
  });

  it('désactive le remplacement si des séries sont déjà enregistrées', async () => {
    const user = userEvent.setup();
    const session = createWorkoutSessionDetail({
      status: 'ACTIVE',
      version: 2,
      exercises: [
        {
          id: 'se-1',
          position: 0,
          sourceExerciseId: 'ex-press',
          exerciseName: 'Presse à cuisses',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Quadriceps',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: null, code: null, name: 'Machine' },
          notes: null,
          restSeconds: 90,
          sets: [
            createWorkoutSet({
              id: 'ws-1',
              status: 'COMPLETED',
              actualWeightKg: 80,
              actualReps: 10,
            }),
          ],
        },
      ],
    });

    renderPanel({
      session,
      exercise: session.exercises[0]!,
    });

    await user.click(
      screen.getByRole('button', { name: 'Actions de l’exercice' }),
    );
    expect(
      screen.getByRole('menuitem', { name: 'Remplacer l’exercice' }),
    ).toBeDisabled();
  });

  it('désactive le remplacement hors ligne', async () => {
    const user = userEvent.setup();
    renderPanel({ browserOffline: true });

    await user.click(
      screen.getByRole('button', { name: 'Actions de l’exercice' }),
    );
    const item = screen.getByRole('menuitem', {
      name: 'Remplacer l’exercice',
    });
    expect(item).toBeDisabled();
    expect(item).toHaveAttribute(
      'title',
      'Connexion nécessaire pour remplacer un exercice.',
    );
  });
});
