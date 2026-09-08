import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

vi.mock('../api/workout-api', async () => {
  const actual = await vi.importActual<typeof import('../api/workout-api')>('../api/workout-api');
  return {
    ...actual,
    updateWorkoutSet: vi.fn(),
    addWorkoutSessionSet: vi.fn(),
    addWorkoutSessionExercise: vi.fn(),
    replaceWorkoutSessionExercise: vi.fn(),
  };
});

vi.mock('../offline/store', () => ({
  persistServerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function renderPanel(sourceExerciseId: string | null) {
  const session = createWorkoutSessionDetail({
    exercises: [
      {
        id: 'wse-copy',
        position: 0,
        sourceExerciseId,
        exerciseName: 'Leg Extension',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Quadriceps',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: 'eq-1', code: 'machine', name: 'Machine' },
        notes: null,
        restSeconds: 90,
        sets: [
          createWorkoutSet({
            id: 'ws-1',
            position: 0,
            status: 'COMPLETED',
            actualWeightKg: 50,
            actualReps: 12,
          }),
          createWorkoutSet({
            id: 'ws-2',
            position: 1,
            status: 'PENDING',
            targetWeightKg: 40,
            targetRepMin: 10,
            targetRepMax: 12,
          }),
        ],
      },
    ],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], { data: { id: 'u1' } });
  const exercise = session.exercises[0]!;

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ActiveExercisePanel
          session={session}
          exercise={exercise}
          effortTrackingMode="RIR"
          canRecordSets
          nextPendingSetId="ws-2"
          exerciseIndex={0}
          totalExercises={1}
          onVersionConflict={vi.fn()}
          onSetRecorded={vi.fn()}
          hasNextExercise={false}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Copier la série précédente (ActiveExercisePanel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copie la série précédente d’un exercice ajouté à la volée', async () => {
    const user = userEvent.setup();
    renderPanel(null);
    await user.click(screen.getByRole('button', { name: /Série 2,/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', {
        name: /^Copier la série précédente$/i,
      }),
    );
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(50);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(12);
  });

  it('copie la série précédente d’un exercice remplacé', async () => {
    const user = userEvent.setup();
    renderPanel('ex-replaced');
    await user.click(screen.getByRole('button', { name: /Série 2,/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', {
        name: /^Copier la série précédente$/i,
      }),
    );
    expect(within(dialog).getByLabelText(/Charge \(kg\)/i)).toHaveValue(50);
    expect(within(dialog).getByLabelText(/^Répétitions$/i)).toHaveValue(12);
  });
});
