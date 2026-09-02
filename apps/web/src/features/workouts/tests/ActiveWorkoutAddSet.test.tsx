import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

const addWorkoutSessionSet = vi.fn();
const listExercises = vi.fn();

vi.mock('../api/workout-api', async () => {
  const actual = await vi.importActual<typeof import('../api/workout-api')>(
    '../api/workout-api',
  );
  return {
    ...actual,
    addWorkoutSessionSet: (...args: unknown[]) => addWorkoutSessionSet(...args),
    addWorkoutSessionExercise: vi.fn(),
    replaceWorkoutSessionExercise: vi.fn(),
  };
});

vi.mock('@/features/exercises/api/exercise-api', () => ({
  listExercises: (...args: unknown[]) => listExercises(...args),
  getExercise: vi.fn(),
  listMuscleGroups: vi.fn().mockResolvedValue([]),
  listEquipmentTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../offline/store', () => ({
  persistServerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function renderPanel() {
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
        equipment: { id: 'eq-1', code: 'MACHINE', name: 'Machine' },
        notes: null,
        restSeconds: 90,
        sets: [createWorkoutSet({ id: 'ws-1', status: 'PENDING' })],
      },
    ],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], { data: { id: 'u1' } });

  return {
    session,
    ...render(
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
            onVersionConflict={vi.fn()}
            onSetRecorded={vi.fn()}
            loadCuesReady
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('Ajouter une série (Active Workout)', () => {
  beforeEach(() => {
    addWorkoutSessionSet.mockReset();
    listExercises.mockResolvedValue({
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ajoute une série WORKING vide et l’affiche sans reload', async () => {
    const user = userEvent.setup();
    const { session } = renderPanel();
    addWorkoutSessionSet.mockResolvedValue(
      createWorkoutSessionDetail({
        ...session,
        version: 4,
        exercises: [
          {
            ...session.exercises[0]!,
            sets: [
              ...session.exercises[0]!.sets,
              createWorkoutSet({
                id: 'ws-2',
                position: 1,
                status: 'PENDING',
                targetWeightKg: null,
                targetRepMin: null,
                targetRepMax: null,
              }),
            ],
          },
        ],
      }),
    );

    await user.click(
      screen.getByRole('button', { name: /Ajouter une série/i }),
    );

    await waitFor(() => {
      expect(addWorkoutSessionSet).toHaveBeenCalledWith(
        session.id,
        'se-1',
        expect.objectContaining({ expectedVersion: 3 }),
      );
    });
  });

  it('affiche le record et l’historique', async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <MemoryRouter>
          <ActiveExercisePanel
            session={createWorkoutSessionDetail()}
            exercise={createWorkoutSessionDetail().exercises[0]!}
            effortTrackingMode="RIR"
            canRecordSets
            nextPendingSetId="ws-1"
            exerciseIndex={0}
            totalExercises={1}
            hasNextExercise={false}
            onVersionConflict={vi.fn()}
            onSetRecorded={vi.fn()}
            loadCuesReady
            loadRecords={[
              {
                exerciseId: 'ex-1',
                exercise: {
                  id: 'ex-1',
                  name: 'Développé couché',
                  measurementType: 'WEIGHT_REPS',
                  archived: false,
                },
                equipment: { id: 'eq-1', name: 'Barre' },
                recordType: 'MAX_WEIGHT',
                value: 110,
                context: {
                  weightKg: 110,
                  reps: 3,
                  durationSeconds: null,
                  distanceMeters: null,
                  rir: null,
                  rpe: null,
                  reachedFailure: false,
                  setType: 'WORKING',
                },
                achievedOn: '2026-08-01',
                achievedAt: null,
                source: {
                  workoutSessionId: 'ws-old',
                  workoutSessionExerciseId: 'wse-old',
                  workoutSetId: 'set-old',
                },
              },
            ]}
            lastWorkingSet={{
              exerciseId: 'ex-1',
              actualWeightKg: 80,
              actualReps: 10,
              actualDurationSeconds: null,
              actualDistanceMeters: null,
              setType: 'WORKING',
              localDate: '2026-08-20',
              workoutSessionId: 'ws-prev',
              workoutSetId: 'set-prev',
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Dernière fois/)).toBeInTheDocument();
    expect(screen.getByText('80 kg × 10')).toBeInTheDocument();
    expect(screen.getByText(/Record/)).toBeInTheDocument();
    expect(screen.getByText('110 kg × 3')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Voir l’historique/i }),
    ).toHaveAttribute('href', '/progress/exercises/ex-1');
  });

  it('n’affiche pas un faux record en kg pour un exercice DURATION', () => {
    const session = createWorkoutSessionDetail({
      exercises: [
        {
          ...createWorkoutSessionDetail().exercises[0]!,
          measurementType: 'DURATION',
          exerciseName: 'Planche',
        },
      ],
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <MemoryRouter>
          <ActiveExercisePanel
            session={session}
            exercise={session.exercises[0]!}
            effortTrackingMode="NONE"
            canRecordSets
            nextPendingSetId="ws-1"
            exerciseIndex={0}
            totalExercises={1}
            hasNextExercise={false}
            onVersionConflict={vi.fn()}
            onSetRecorded={vi.fn()}
            loadCuesReady
            loadRecords={[]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText(/Record/)).not.toBeInTheDocument();
    expect(screen.queryByText('0 kg')).not.toBeInTheDocument();
  });
});
