import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateExercisePage } from '../pages/CreateExercisePage';

const listMuscleGroups = vi.fn();
const listEquipmentTypes = vi.fn();
const createExercise = vi.fn();

vi.mock('../api/exercise-api', async () => {
  const actual = await vi.importActual<typeof import('../api/exercise-api')>(
    '../api/exercise-api',
  );
  return {
    ...actual,
    listMuscleGroups: (...args: unknown[]) => listMuscleGroups(...args),
    listEquipmentTypes: (...args: unknown[]) => listEquipmentTypes(...args),
    createExercise: (...args: unknown[]) => createExercise(...args),
  };
});

const MUSCLE_CHEST = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EQ_BARBELL = '11111111-1111-1111-1111-111111111111';

function renderCreate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/exercises/new']}>
        <Routes>
          <Route path="/exercises/new" element={children} />
          <Route path="/exercises/:exerciseId" element={<div>Detail page</div>} />
          <Route path="/exercises" element={<div>Catalogue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(<CreateExercisePage />, { wrapper });
}

describe('CreateExercisePage', () => {
  beforeEach(() => {
    listMuscleGroups.mockReset();
    listEquipmentTypes.mockReset();
    createExercise.mockReset();
    listMuscleGroups.mockResolvedValue([
      { id: MUSCLE_CHEST, code: 'chest', name: 'Pectoraux', parentId: null },
    ]);
    listEquipmentTypes.mockResolvedValue([
      { id: EQ_BARBELL, code: 'barbell', name: 'Barre' },
    ]);
  });

  it('loads references and creates an exercise once', async () => {
    const user = userEvent.setup();
    createExercise.mockResolvedValue({
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      source: 'USER',
      name: 'Nouveau perso',
      measurementType: 'WEIGHT_REPS',
      primaryMuscleGroup: {
        id: MUSCLE_CHEST,
        code: 'chest',
        name: 'Pectoraux',
        parentId: null,
      },
      secondaryMuscleGroups: [],
      defaultEquipmentType: null,
      compatibleEquipmentTypes: [],
      defaultRestSeconds: null,
      instructions: null,
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
    });

    renderCreate();
    expect(await screen.findByRole('heading', { name: /Créer un exercice/i })).toBeInTheDocument();
    await screen.findByLabelText(/Nom/i);

    await user.type(screen.getByLabelText(/Nom/i), 'Nouveau perso');
    await user.selectOptions(
      screen.getByLabelText(/Groupe musculaire principal/i),
      MUSCLE_CHEST,
    );
    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));

    await waitFor(() => expect(createExercise).toHaveBeenCalledTimes(1));
    expect(createExercise.mock.calls[0]?.[0]).toMatchObject({
      name: 'Nouveau perso',
      primaryMuscleGroupId: MUSCLE_CHEST,
      measurementType: 'WEIGHT_REPS',
    });
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
  });

  it('keeps values and shows API error', async () => {
    const user = userEvent.setup();
    createExercise.mockRejectedValue(new Error('Création refusée'));
    renderCreate();

    await screen.findByLabelText(/Nom/i);
    await user.type(screen.getByLabelText(/Nom/i), 'Échec');
    await user.selectOptions(
      screen.getByLabelText(/Groupe musculaire principal/i),
      MUSCLE_CHEST,
    );
    await user.click(screen.getByRole('button', { name: /Créer l’exercice/i }));

    expect(await screen.findByText('Création refusée')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom/i)).toHaveValue('Échec');
  });

  it('shows reference error with retry', async () => {
    listMuscleGroups.mockRejectedValue(new Error('Références indisponibles'));
    renderCreate();
    expect(await screen.findByText(/Références indisponibles/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
  });
});
