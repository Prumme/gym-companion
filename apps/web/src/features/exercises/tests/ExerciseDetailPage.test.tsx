import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseDetailPage } from '../pages/ExerciseDetailPage';
import { createExerciseListItem } from './fixtures';

const {
  getExercise,
  updateExercisePreference,
  resetExercisePreference,
  archiveExercise,
  restoreExercise,
  listExercisePersonalRecords,
} = vi.hoisted(() => ({
  getExercise: vi.fn(),
  updateExercisePreference: vi.fn(),
  resetExercisePreference: vi.fn(),
  archiveExercise: vi.fn(),
  restoreExercise: vi.fn(),
  listExercisePersonalRecords: vi.fn(),
}));

vi.mock('@/features/personal-records/api/personal-records-api', () => ({
  listExercisePersonalRecords: (...args: unknown[]) =>
    listExercisePersonalRecords(...args),
  listPersonalRecords: vi.fn(),
}));

vi.mock('../api/exercise-api', async () => {
  const actual = await vi.importActual<typeof import('../api/exercise-api')>(
    '../api/exercise-api',
  );
  return {
    ...actual,
    getExercise: (...args: unknown[]) => getExercise(...args),
    updateExercisePreference: (...args: unknown[]) =>
      updateExercisePreference(...args),
    resetExercisePreference: (...args: unknown[]) =>
      resetExercisePreference(...args),
    archiveExercise: (...args: unknown[]) => archiveExercise(...args),
    restoreExercise: (...args: unknown[]) => restoreExercise(...args),
  };
});

function createDetail(overrides: Record<string, unknown> = {}) {
  const base = createExerciseListItem();
  return {
    ...base,
    secondaryMuscleGroups: [
      { id: 't', code: 'triceps', name: 'Triceps', parentId: null },
    ],
    compatibleEquipmentTypes: [
      {
        equipmentType: {
          id: '11111111-1111-1111-1111-111111111111',
          code: 'barbell',
          name: 'Barre',
        },
        isPreferred: true,
        notes: null,
      },
      {
        equipmentType: {
          id: '22222222-2222-2222-2222-222222222222',
          code: 'dumbbell',
          name: 'Haltères',
        },
        isPreferred: false,
        notes: null,
      },
    ],
    instructions: 'Contrôler la descente.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderDetail(id = 'exercise-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/exercises/${id}`,
            state: { from: '/exercises?favoriteOnly=true' },
          },
        ]}
      >
        <Routes>
          <Route path="/exercises/:exerciseId" element={children} />
          <Route path="/exercises" element={<div>Catalogue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(<ExerciseDetailPage />, { wrapper });
}

describe('ExerciseDetailPage preferences', () => {
  beforeEach(() => {
    getExercise.mockReset();
    updateExercisePreference.mockReset();
    resetExercisePreference.mockReset();
    archiveExercise.mockReset();
    restoreExercise.mockReset();
    listExercisePersonalRecords.mockReset();
    listExercisePersonalRecords.mockResolvedValue([]);
  });

  it('loads detail and shows preferences', async () => {
    getExercise.mockResolvedValue(createDetail());
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'Développé couché à la barre' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Préférences')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Voir ma progression/i }),
    ).toHaveAttribute('href', '/progress/exercises/exercise-1');
    expect(screen.getByText('Autorisées')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /modifier l’exercice/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '← Exercices' }),
    ).toHaveAttribute('href', '/exercises?favoriteOnly=true');
  });

  it('opens preference form limited to compatible equipment', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(createDetail());
    renderDetail();

    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    await user.click(screen.getByRole('button', { name: 'Modifier mes préférences' }));

    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByLabelText('Équipement préféré');
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Aucun équipement préféré',
      'Barre',
      'Haltères',
    ]);
  });

  it('validates invalid rest seconds', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(createDetail());
    renderDetail();

    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    await user.click(screen.getByRole('button', { name: 'Modifier mes préférences' }));
    await user.type(screen.getByLabelText(/Repos personnel/), 'abc');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText(/entier/i)).toBeInTheDocument();
    expect(updateExercisePreference).not.toHaveBeenCalled();
  });

  it('saves preferences successfully', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(createDetail());
    updateExercisePreference.mockResolvedValue({
      isFavorite: true,
      isExcludedFromSuggestions: true,
      preferredEquipmentType: {
        id: '22222222-2222-2222-2222-222222222222',
        code: 'dumbbell',
        name: 'Haltères',
      },
      restSecondsOverride: 90,
    });

    renderDetail();
    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    await user.click(screen.getByRole('button', { name: 'Modifier mes préférences' }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Favori'));
    await user.click(
      within(dialog).getByLabelText(/Ne pas proposer automatiquement cet exercice/),
    );
    await user.selectOptions(
      within(dialog).getByLabelText('Équipement préféré'),
      '22222222-2222-2222-2222-222222222222',
    );
    await user.clear(within(dialog).getByLabelText(/Repos personnel/));
    await user.type(within(dialog).getByLabelText(/Repos personnel/), '90');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(updateExercisePreference).toHaveBeenCalledWith('exercise-1', {
        isFavorite: true,
        isExcludedFromSuggestions: true,
        preferredEquipmentTypeId: '22222222-2222-2222-2222-222222222222',
        restSecondsOverride: 90,
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Préférences enregistrées.',
    );
  });

  it('keeps detail visible when preference save fails', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(createDetail());
    updateExercisePreference.mockRejectedValue(new Error('Échec enregistrement'));

    renderDetail();
    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    await user.click(screen.getByRole('button', { name: 'Modifier mes préférences' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Échec enregistrement');
    expect(
      screen.getByRole('heading', { name: 'Développé couché à la barre' }),
    ).toBeInTheDocument();
  });

  it('resets preferences after confirmation', async () => {
    const user = userEvent.setup();
    getExercise.mockResolvedValue(
      createDetail({
        userPreference: {
          isFavorite: true,
          isExcludedFromSuggestions: true,
          preferredEquipmentType: {
            id: '11111111-1111-1111-1111-111111111111',
            code: 'barbell',
            name: 'Barre',
          },
          restSecondsOverride: 75,
        },
      }),
    );
    resetExercisePreference.mockResolvedValue(undefined);

    renderDetail();
    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    await user.click(
      screen.getByRole('button', { name: 'Réinitialiser les préférences' }),
    );
    expect(
      screen.getByRole('alertdialog'),
    ).toHaveTextContent('Réinitialiser tes préférences');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    await waitFor(() => {
      expect(resetExercisePreference).toHaveBeenCalledTimes(1);
      expect(resetExercisePreference).toHaveBeenCalledWith('exercise-1');
    });
  });

  it('shows inaccessible message', async () => {
    getExercise.mockRejectedValue(
      Object.assign(new Error('Exercice introuvable.'), { status: 404 }),
    );
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cet exercice est introuvable ou inaccessible.',
    );
  });

  it('shows archived badge', async () => {
    getExercise.mockResolvedValue(
      createDetail({ archivedAt: '2026-08-01T00:00:00.000Z' }),
    );
    renderDetail();
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
  });
});

describe('ExerciseDetailPage management', () => {
  beforeEach(() => {
    getExercise.mockReset();
    updateExercisePreference.mockReset();
    resetExercisePreference.mockReset();
    archiveExercise.mockReset();
    restoreExercise.mockReset();
    listExercisePersonalRecords.mockReset();
    listExercisePersonalRecords.mockResolvedValue([]);
  });

  it('hides edit/archive for system exercises', async () => {
    getExercise.mockResolvedValue(createDetail());
    renderDetail();
    await screen.findByRole('heading', { name: 'Développé couché à la barre' });
    expect(screen.queryByText('Gestion de l’exercice')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Modifier l’exercice/i }),
    ).not.toBeInTheDocument();
  });

  it('archives a personal exercise after confirmation and preserves preferences', async () => {
    const user = userEvent.setup();
    const personal = createDetail({
      id: 'user-ex-1',
      source: 'USER',
      name: 'Curl perso',
      permissions: { canEdit: true, canArchive: true, canRestore: false },
      userPreference: {
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentType: null,
        restSecondsOverride: 40,
      },
    });
    getExercise.mockResolvedValue(personal);
    archiveExercise.mockResolvedValue({
      ...personal,
      archivedAt: '2026-08-03T00:00:00.000Z',
      permissions: { canEdit: false, canArchive: false, canRestore: true },
    });

    renderDetail('user-ex-1');
    await screen.findByRole('heading', { name: 'Curl perso' });
    expect(
      screen.getByRole('link', { name: /Modifier l’exercice/i }),
    ).toHaveAttribute('href', '/exercises/user-ex-1/edit');

    await user.click(screen.getByRole('button', { name: /Archiver l’exercice/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Archiver cet exercice ?',
    );
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(archiveExercise).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Archiver l’exercice/i }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Archiver',
      }),
    );

    await waitFor(() => {
      expect(archiveExercise).toHaveBeenCalledTimes(1);
      expect(archiveExercise).toHaveBeenCalledWith('user-ex-1');
    });
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(await screen.findByText('Exercice archivé.')).toBeInTheDocument();
    expect(screen.getByText('Préférences')).toBeInTheDocument();
  });

  it('restores an archived personal exercise', async () => {
    const user = userEvent.setup();
    const archived = createDetail({
      id: 'user-ex-2',
      source: 'USER',
      name: 'Row perso',
      archivedAt: '2026-08-01T00:00:00.000Z',
      permissions: { canEdit: false, canArchive: false, canRestore: true },
      userPreference: {
        isFavorite: true,
        isExcludedFromSuggestions: true,
        preferredEquipmentType: null,
        restSecondsOverride: 55,
      },
    });
    getExercise.mockResolvedValue(archived);
    restoreExercise.mockResolvedValue({
      ...archived,
      archivedAt: null,
      permissions: { canEdit: true, canArchive: true, canRestore: false },
    });

    renderDetail('user-ex-2');
    await screen.findByRole('heading', { name: 'Row perso' });
    expect(
      screen.queryByRole('link', { name: /Modifier l’exercice/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Restaurer l’exercice/i }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Restaurer',
      }),
    );

    await waitFor(() => {
      expect(restoreExercise).toHaveBeenCalledWith('user-ex-2');
    });
    expect(await screen.findByText('Exercice restauré.')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /Modifier l’exercice/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Archivé')).not.toBeInTheDocument();
  });
});
