import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
const getActiveProgram = vi.fn();
const addWorkoutTemplateExercise = vi.fn();
const createWorkoutTemplateSet = vi.fn();
const updateWorkoutTemplateSet = vi.fn();
const deleteWorkoutTemplateSet = vi.fn();
const removeWorkoutTemplateExercise = vi.fn();
const reorderWorkoutTemplateExercises = vi.fn();
const reorderWorkoutTemplateSets = vi.fn();
const listExercises = vi.fn();
const getExercise = vi.fn();
const listMuscleGroups = vi.fn();
const listEquipmentTypes = vi.fn();
const getActiveWorkoutSession = vi.fn();
const getMe = vi.fn();
const getLoadRecommendation = vi.fn();
const listLoadRecommendationDecisions = vi.fn();

vi.mock('../api/program-api', async () => {
  const actual = await vi.importActual<typeof import('../api/program-api')>(
    '../api/program-api',
  );
  return {
    ...actual,
    getProgram: (...args: unknown[]) => getProgram(...args),
    getActiveProgram: (...args: unknown[]) => getActiveProgram(...args),
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
    reorderWorkoutTemplateExercises: (...args: unknown[]) =>
      reorderWorkoutTemplateExercises(...args),
    reorderWorkoutTemplateSets: (...args: unknown[]) =>
      reorderWorkoutTemplateSets(...args),
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

vi.mock('@/features/workouts/api/workout-api', () => ({
  getActiveWorkoutSession: (...args: unknown[]) =>
    getActiveWorkoutSession(...args),
  createWorkoutSession: vi.fn(),
  getWorkoutSessionDetail: vi.fn(),
}));

vi.mock('@/features/profile/api/profile-api', () => ({
  getMe: (...args: unknown[]) => getMe(...args),
}));

vi.mock('@/features/coaching/api/coaching-api', () => ({
  getLoadRecommendation: (...args: unknown[]) => getLoadRecommendation(...args),
  listLoadRecommendationDecisions: (...args: unknown[]) =>
    listLoadRecommendationDecisions(...args),
  decideLoadRecommendation: vi.fn(),
}));

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

async function openTemplate(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Push A',
) {
  const row = await screen.findByRole('button', {
    name: new RegExp(`^${name}\\b`, 'i'),
  });
  await user.click(row);
  expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
}

function renderDetail(detail = createProgramDetail()) {
  getProgram.mockResolvedValue(detail);
  getActiveProgram.mockResolvedValue(null);
  getActiveWorkoutSession.mockResolvedValue(null);
  getMe.mockResolvedValue({
    data: { profile: { timezone: 'Europe/Paris' } },
  });
  listLoadRecommendationDecisions.mockResolvedValue({
    data: [],
    pagination: { nextCursor: null, hasMore: false },
  });
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
    getActiveProgram.mockReset();
    getActiveWorkoutSession.mockReset();
    getMe.mockReset();
    addWorkoutTemplateExercise.mockReset();
    createWorkoutTemplateSet.mockReset();
    updateWorkoutTemplateSet.mockReset();
    deleteWorkoutTemplateSet.mockReset();
    removeWorkoutTemplateExercise.mockReset();
    reorderWorkoutTemplateExercises.mockReset();
    reorderWorkoutTemplateSets.mockReset();
    listExercises.mockReset();
    getExercise.mockReset();
    listMuscleGroups.mockReset();
    listEquipmentTypes.mockReset();
    getLoadRecommendation.mockReset();
    listLoadRecommendationDecisions.mockReset();
    listMuscleGroups.mockResolvedValue([]);
    listEquipmentTypes.mockResolvedValue([]);
    getLoadRecommendation.mockResolvedValue({
      supported: false,
      workoutTemplateExerciseId: 'tex-1',
      exerciseId: 'ex-1',
    });
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
    await openTemplate(user);
    await user.click(screen.getByRole('button', { name: /Ajouter un exercice/i }));
    expect(await screen.findByText('Choisir un exercice')).toBeInTheDocument();
    expect(screen.getByText(/Déjà ajouté/i)).toBeInTheDocument();
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

  it('renders compact target sets and recommendation line', async () => {
    const user = userEvent.setup();
    getLoadRecommendation.mockResolvedValue({
      workoutTemplateExerciseId: 'tex-1',
      exerciseId: 'ex-1',
      supported: true,
      action: 'HOLD',
      currentTarget: {
        weightKg: 80,
        minReps: 8,
        maxReps: 10,
        targetRir: 2,
        targetRpe: null,
      },
      recommendation: {
        suggestedWeightKg: 80,
        adjustmentKg: 0,
        incrementKg: 2.5,
        incrementSource: 'SYSTEM_DEFAULT',
      },
      evidence: {
        workoutCount: 1,
        latestWorkoutDate: '2026-08-01',
        effortDataUsed: false,
        recentWorkouts: [],
      },
      reasons: ['TARGET_RANGE_PARTIALLY_REACHED'],
      engineVersion: 'LOAD_RECOMMENDATION_V1',
      recommendationFingerprint: 'fp-test',
    });

    renderDetail();
    await openTemplate(user);
    expect(screen.getByText(/8–10 reps/i)).toBeInTheDocument();
    expect(screen.getByText(/RIR 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/Suggestion pour la prochaine séance/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/Suggestion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Voir$/i })).toBeInTheDocument();
  });

  it('hides empty recommendation card in compact builder', async () => {
    const user = userEvent.setup();
    getLoadRecommendation.mockResolvedValue({
      supported: false,
      workoutTemplateExerciseId: 'tex-1',
      exerciseId: 'ex-1',
    });

    renderDetail();
    await openTemplate(user);
    expect(screen.queryByText(/Suggestion pour la prochaine séance/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Voir$/i })).not.toBeInTheDocument();
  });

  it('adds a WEIGHT_REPS set and deletes it via sheet and menu', async () => {
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
    await openTemplate(user);
    await screen.findByText('Développé couché');
    await user.click(screen.getByRole('button', { name: /Ajouter une série/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Répétitions min/i));
    await user.type(screen.getByLabelText(/Répétitions min/i), '6');
    await user.clear(screen.getByLabelText(/Répétitions max/i));
    await user.type(screen.getByLabelText(/Répétitions max/i), '8');
    await user.click(screen.getByRole('button', { name: /Ajouter la série/i }));

    await waitFor(() => expect(createWorkoutTemplateSet).toHaveBeenCalled());
    expect(await screen.findByText(/6–8 reps/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Actions série 1/i }));
    await user.click(screen.getByRole('menuitem', { name: /^Supprimer$/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^Supprimer$/i }));
    await waitFor(() => expect(deleteWorkoutTemplateSet).toHaveBeenCalled());
  });

  it('reorders an exercise via context menu', async () => {
    const user = userEvent.setup();
    const detail = createProgramDetail({
      workoutTemplates: [
        createTemplate({
          exercises: [
            createTemplateExercise({ id: 'tex-1', position: 0 }),
            createTemplateExercise({
              id: 'tex-2',
              position: 1,
              exercise: {
                id: 'ex-2',
                source: 'SYSTEM',
                name: 'Élévations latérales',
                measurementType: 'WEIGHT_REPS',
                primaryMuscleGroup: {
                  id: 'mg-2',
                  code: 'shoulders',
                  name: 'Épaules',
                  parentId: null,
                },
                defaultEquipmentType: {
                  id: 'eq-2',
                  code: 'dumbbell',
                  name: 'Haltères',
                },
                archivedAt: null,
              },
              sets: [],
            }),
          ],
        }),
      ],
    });
    reorderWorkoutTemplateExercises.mockResolvedValue(detail);

    renderDetail(detail);
    await openTemplate(user);
    await user.click(
      screen.getByRole('button', { name: /Actions pour Développé couché/i }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: /Déplacer vers le bas/i }),
    );
    await waitFor(() =>
      expect(reorderWorkoutTemplateExercises).toHaveBeenCalled(),
    );
  });

  it('removes an exercise with confirmation', async () => {
    const user = userEvent.setup();
    removeWorkoutTemplateExercise.mockResolvedValue(
      createProgramDetail({
        workoutTemplates: [createTemplate({ exercises: [] })],
      }),
    );

    renderDetail();
    await openTemplate(user);
    await screen.findByText('Développé couché');
    await user.click(
      screen.getByRole('button', { name: /Actions pour Développé couché/i }),
    );
    await user.click(screen.getByRole('menuitem', { name: /^Supprimer$/i }));
    expect(
      await screen.findByText(/restera disponible dans le catalogue/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Retirer$/i }));
    await waitFor(() => expect(removeWorkoutTemplateExercise).toHaveBeenCalled());
  });
});
