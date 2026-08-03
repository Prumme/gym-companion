import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditExercisePage } from '../pages/EditExercisePage';

const getExercise = vi.fn();
const listMuscleGroups = vi.fn();
const listEquipmentTypes = vi.fn();
const updateExercise = vi.fn();

vi.mock('../api/exercise-api', async () => {
  const actual = await vi.importActual<typeof import('../api/exercise-api')>(
    '../api/exercise-api',
  );
  return {
    ...actual,
    getExercise: (...args: unknown[]) => getExercise(...args),
    listMuscleGroups: (...args: unknown[]) => listMuscleGroups(...args),
    listEquipmentTypes: (...args: unknown[]) => listEquipmentTypes(...args),
    updateExercise: (...args: unknown[]) => updateExercise(...args),
  };
});

const MUSCLE_CHEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MUSCLE_BACK = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EQ_BARBELL = '11111111-1111-1111-1111-111111111111';
const EXERCISE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function createUserDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: EXERCISE_ID,
    source: 'USER',
    name: 'Curl perso',
    measurementType: 'WEIGHT_REPS',
    primaryMuscleGroup: {
      id: MUSCLE_CHEST,
      code: 'chest',
      name: 'Pectoraux',
      parentId: null,
    },
    secondaryMuscleGroups: [],
    defaultEquipmentType: null,
    compatibleEquipmentTypes: [
      {
        equipmentType: { id: EQ_BARBELL, code: 'barbell', name: 'Barre' },
        isPreferred: false,
        notes: 'Note A',
      },
    ],
    defaultRestSeconds: 60,
    instructions: 'Instructions',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    permissions: { canEdit: true, canArchive: true, canRestore: false },
    userPreference: {
      isFavorite: false,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: null,
      restSecondsOverride: null,
    },
    ...overrides,
  };
}

function renderEdit(id = EXERCISE_ID) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/exercises/${id}/edit`]}>
        <Routes>
          <Route path="/exercises/:exerciseId/edit" element={children} />
          <Route path="/exercises/:exerciseId" element={<div>Detail page</div>} />
          <Route path="/exercises" element={<div>Catalogue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(<EditExercisePage />, { wrapper });
}

describe('EditExercisePage', () => {
  beforeEach(() => {
    getExercise.mockReset();
    listMuscleGroups.mockReset();
    listEquipmentTypes.mockReset();
    updateExercise.mockReset();
    listMuscleGroups.mockResolvedValue([
      { id: MUSCLE_CHEST, code: 'chest', name: 'Pectoraux', parentId: null },
      { id: MUSCLE_BACK, code: 'back', name: 'Dos', parentId: null },
    ]);
    listEquipmentTypes.mockResolvedValue([
      { id: EQ_BARBELL, code: 'barbell', name: 'Barre' },
    ]);
  });

  it('prefills and updates a personal exercise', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(createUserDetail());
    updateExercise.mockResolvedValue(
      createUserDetail({ name: 'Curl modifié' }),
    );

    renderEdit();
    expect(await screen.findByDisplayValue('Curl perso')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Note A')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Nom/i));
    await user.type(screen.getByLabelText(/Nom/i), 'Curl modifié');
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }));

    await waitFor(() => expect(updateExercise).toHaveBeenCalledTimes(1));
    expect(updateExercise.mock.calls[0]?.[0]).toBe(EXERCISE_ID);
    expect(updateExercise.mock.calls[0]?.[1]).toMatchObject({
      name: 'Curl modifié',
      compatibleEquipmentTypes: [
        expect.objectContaining({ notes: 'Note A' }),
      ],
    });
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
  });

  it('refuses system exercises', async () => {
    getExercise.mockResolvedValue(
      createUserDetail({
        source: 'SYSTEM',
        permissions: { canEdit: false, canArchive: false, canRestore: false },
      }),
    );
    renderEdit();
    expect(
      await screen.findByText(/Modification indisponible/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nom/i)).not.toBeInTheDocument();
  });

  it('refuses archived exercises', async () => {
    getExercise.mockResolvedValue(
      createUserDetail({
        archivedAt: '2026-02-01T00:00:00.000Z',
        permissions: { canEdit: false, canArchive: false, canRestore: true },
      }),
    );
    renderEdit();
    expect(await screen.findByText(/Exercice archivé/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nom/i)).not.toBeInTheDocument();
  });

  it('shows inaccessible exercise message', async () => {
    const error = Object.assign(new Error('Introuvable'), { status: 404 });
    getExercise.mockRejectedValue(error);
    renderEdit();
    expect(
      await screen.findByText(/introuvable ou inaccessible/i),
    ).toBeInTheDocument();
  });
});
