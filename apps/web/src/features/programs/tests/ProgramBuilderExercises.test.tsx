import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExerciseDetail, ExerciseListItem } from '@gym-companion/shared';

import { ProgramDetailPage } from '../pages/ProgramDetailPage';
import {
  createProgramDetail,
  createSet,
  createTemplate,
  createTemplateExercise,
} from './fixtures';

const getProgram = vi.fn();
const addWorkoutTemplateExercise = vi.fn();
const createWorkoutTemplateSet = vi.fn();
const updateWorkoutTemplateSet = vi.fn();
const deleteWorkoutTemplateSet = vi.fn();
const removeWorkoutTemplateExercise = vi.fn();
const listExercises = vi.fn();
const getExercise = vi.fn();
const listMuscleGroups = vi.fn();
const listEquipmentTypes = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    addWorkoutTemplateExercise: (...args: unknown[]) =>
      addWorkoutTemplateExercise(...args),
    createWorkoutTemplateSet: (...args: unknown[]) =>
      createWorkoutTemplateSet(...args),
    updateWorkoutTemplateSet: (...args: unknown[]) =>
      updateWorkoutTemplateSet(...args),
    deleteWorkoutTemplateSet: (...args: unknown[]) =>
      deleteWorkoutTemplateSet(...args),
    removeWorkoutTemplateExercise: (...args: unknown[]) =>
      removeWorkoutTemplateExercise(...args),
  };
});

vi.mock('@/features/exercises/api/exercise-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/exercises/api/exercise-api')
  >('@/features/exercises/api/exercise-api');
  return {
    ...actual,
    listExercises: (...args: unknown[]) => listExercises(...args),
    getExercise: (...args: unknown[]) => getExercise(...args),
    listMuscleGroups: (...args: unknown[]) => listMuscleGroups(...args),
    listEquipmentTypes: (...args: unknown[]) => listEquipmentTypes(...args),
  };
});

const PROGRAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const catalogExercise: ExerciseListItem = {
  id: 'ex-new',
  source: 'SYSTEM',
  name: 'Rowing barre',
  measurementType: 'WEIGHT_REPS',
  primaryMuscleGroup: {
    id: 'mg-back',
    code: 'back',
    name: 'Dos',
    parentId: null,
  },
  defaultEquipmentType: { id: 'eq-1', code: 'barbell', name: 'Barre' },
  defaultRestSeconds: 90,
  archivedAt: null,
  permissions: { canEdit: false, canArchive: false, canRestore: false },
  userPreference: {
    isFavorite: false,
    isExcludedFromSuggestions: false,
    preferredEquipmentType: {
      id: 'eq-1',
      code: 'barbell',
      name: 'Barre',
    },
    restSecondsOverride: 75,
  },
};

const catalogDetail: ExerciseDetail = {
  ...catalogExercise,
  secondaryMuscleGroups: [],
  compatibleEquipmentTypes: [
    {
      equipmentType: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      isPreferred: true,
      notes: null,
    },
  ],
  instructions: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderDetail(detail = createProgramDetail()) {
  getProgram.mockResolvedValue(detail);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/programs/${PROGRAM_ID}`]}>
        <Routes>
          <Route path="/programs/:programId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProgramDetailPage />, { wrapper });
}

describe('Program builder exercises and sets', () => {
  beforeEach(() => {
    getProgram.mockReset();
    addWorkoutTemplateExercise.mockReset();
    createWorkoutTemplateSet.mockReset();
    updateWorkoutTemplateSet.mockReset();
    deleteWorkoutTemplateSet.mockReset();
    removeWorkoutTemplateExercise.mockReset();
    listExercises.mockReset();
    getExercise.mockReset();
    listMuscleGroups.mockReset();
    listEquipmentTypes.mockReset();
    listMuscleGroups.mockResolvedValue([]);
    listEquipmentTypes.mockResolvedValue([]);
    listExercises.mockResolvedValue({
      data: [
        catalogExercise,
        {
          ...catalogExercise,
          id: 'ex-1',
          name: 'Développé couché',
        },
      ],
      pagination: { nextCursor: null, hasMore: false },
    });
    getExercise.mockResolvedValue(catalogDetail);
  });

  it('opens picker, disables already added, and adds with preferred equipment', async () => {
    const user = userEvent.setup();
    const initial = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [createTemplateExercise()],
        }),
      ],
    });
    const withExercise = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [
            createTemplateExercise(),
            createTemplateExercise({
              id: 'tex-2',
              position: 1,
              exercise: {
                id: 'ex-new',
                source: 'SYSTEM',
                name: 'Rowing barre',
                measurementType: 'WEIGHT_REPS',
                primaryMuscleGroup: catalogExercise.primaryMuscleGroup,
                defaultEquipmentType: catalogExercise.defaultEquipmentType,
                archivedAt: null,
              },
              equipmentType: catalogExercise.defaultEquipmentType,
              restSecondsOverride: 75,
              sets: [],
            }),
          ],
        }),
      ],
    });
    addWorkoutTemplateExercise.mockResolvedValue(withExercise);

    renderDetail(initial);
    await screen.findByText('Push A');
    await user.click(screen.getByRole('button', { name: /Ajouter un exercice/i }));
    expect(await screen.findByText('Choisir un exercice')).toBeInTheDocument();
    expect(screen.getByText('Déjà ajouté')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Rowing barre/i }));

    expect(await screen.findByLabelText(/Équipement prévu/i)).toHaveValue('eq-1');
    expect(screen.getByLabelText(/Repos prévu/i)).toHaveValue('75');
    await user.click(screen.getByRole('button', { name: /^Ajouter$/i }));

    await waitFor(() =>
      expect(addWorkoutTemplateExercise).toHaveBeenCalledWith(
        PROGRAM_ID,
        'wt-1',
        expect.objectContaining({
          exerciseId: 'ex-new',
          equipmentTypeId: 'eq-1',
          restSecondsOverride: 75,
        }),
      ),
    );
  });

  it('adds a WEIGHT_REPS set and deletes it', async () => {
    const user = userEvent.setup();
    const initial = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [createTemplateExercise({ sets: [] })],
        }),
      ],
    });
    const withSet = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [
            createTemplateExercise({
              sets: [createSet({ id: 'set-new', targetRepMin: 6, targetRepMax: 8 })],
            }),
          ],
        }),
      ],
    });
    createWorkoutTemplateSet.mockResolvedValue(withSet);
    deleteWorkoutTemplateSet.mockResolvedValue(
      createProgramDetail({
        workoutTemplates: [
          createTemplate({
            exercises: [createTemplateExercise({ sets: [] })],
          }),
        ],
      }),
    );

    renderDetail(initial);
    await screen.findByText('Développé couché');
    await user.click(screen.getByRole('button', { name: /Ajouter une série/i }));
    await user.clear(screen.getByLabelText(/Répétitions min/i));
    await user.type(screen.getByLabelText(/Répétitions min/i), '6');
    await user.clear(screen.getByLabelText(/Répétitions max/i));
    await user.type(screen.getByLabelText(/Répétitions max/i), '8');
    await user.click(screen.getByRole('button', { name: /^Ajouter$/i }));

    await waitFor(() => expect(createWorkoutTemplateSet).toHaveBeenCalled());
    expect(await screen.findByText(/6 à 8 répétitions/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Supprimer la série 1/i }));
    await user.click(screen.getByRole('button', { name: /^Supprimer$/i }));
    await waitFor(() => expect(deleteWorkoutTemplateSet).toHaveBeenCalled());
  });

  it('removes an exercise with confirmation', async () => {
    const user = userEvent.setup();
    removeWorkoutTemplateExercise.mockResolvedValue(
      createProgramDetail({
        workoutTemplates: [createTemplate({ exercises: [] })],
      }),
    );

    renderDetail();
    await screen.findByText('Développé couché');
    await user.click(
      screen.getByRole('button', { name: /Actions pour Développé couché/i }),
    );
    await user.click(screen.getByRole('button', { name: /^Retirer$/i }));
    expect(
      await screen.findByText(/restera disponible dans le catalogue/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Retirer$/i }));
    await waitFor(() => expect(removeWorkoutTemplateExercise).toHaveBeenCalled());
  });
});
