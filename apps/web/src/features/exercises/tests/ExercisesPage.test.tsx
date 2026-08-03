import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExercisesPage } from '../pages/ExercisesPage';
import { createExerciseListItem } from './fixtures';

const listExercises = vi.fn();
const listMuscleGroups = vi.fn();
const listEquipmentTypes = vi.fn();
const getExercise = vi.fn();

vi.mock('../api/exercise-api', () => ({
  listExercises: (...args: unknown[]) => listExercises(...args),
  listMuscleGroups: (...args: unknown[]) => listMuscleGroups(...args),
  listEquipmentTypes: (...args: unknown[]) => listEquipmentTypes(...args),
  getExercise: (...args: unknown[]) => getExercise(...args),
  updateExercisePreference: vi.fn(),
  resetExercisePreference: vi.fn(),
  getExercisePreference: vi.fn(),
  buildExerciseListSearchParams: vi.fn(),
}));

const muscleGroups = [
  { id: 'muscle-chest', code: 'chest', name: 'Pectoraux', parentId: null },
  { id: 'muscle-back', code: 'back', name: 'Dos', parentId: null },
];

const equipmentTypes = [
  { id: 'eq-barbell', code: 'barbell', name: 'Barre' },
  { id: 'eq-dumbbell', code: 'dumbbell', name: 'Haltères' },
];

function pageResponse(
  items: ReturnType<typeof createExerciseListItem>[],
  hasMore = false,
  nextCursor: string | null = null,
) {
  return {
    data: items,
    pagination: { hasMore, nextCursor },
  };
}

function renderPage(initialEntry = '/exercises') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/exercises" element={children} />
          <Route path="/exercises/:exerciseId" element={<div>Detail stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(<ExercisesPage />, { wrapper });
}

describe('ExercisesPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    listExercises.mockReset();
    listMuscleGroups.mockReset();
    listEquipmentTypes.mockReset();
    getExercise.mockReset();
    listMuscleGroups.mockResolvedValue(muscleGroups);
    listEquipmentTypes.mockResolvedValue(equipmentTypes);
  });

  it('renders the first page', async () => {
    listExercises.mockResolvedValue(
      pageResponse([
        createExerciseListItem({ id: '1', name: 'Squat' }),
        createExerciseListItem({ id: '2', name: 'Soulevé de terre' }),
      ]),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Exercices' })).toBeInTheDocument();
    expect(await screen.findByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Soulevé de terre')).toBeInTheDocument();
    expect(screen.getByText('2 exercices chargés')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /créer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archiver/i })).not.toBeInTheDocument();
  });

  it('loads the next page without duplicates', async () => {
    const user = userEvent.setup();
    listExercises
      .mockResolvedValueOnce(
        pageResponse(
          [createExerciseListItem({ id: '1', name: 'Page 1' })],
          true,
          'cursor-1',
        ),
      )
      .mockResolvedValueOnce(
        pageResponse([createExerciseListItem({ id: '2', name: 'Page 2' })]),
      );

    renderPage();
    expect(await screen.findByText('Page 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Page \d/).length).toBe(2);
    expect(listExercises.mock.calls[1]?.[0]).toMatchObject({ cursor: 'cursor-1' });
  });

  it('debounces search into the list query', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    listExercises.mockResolvedValue(pageResponse([]));

    renderPage();
    await screen.findByRole('heading', { name: 'Exercices' });

    await user.type(screen.getByPlaceholderText('Rechercher un exercice'), 'squat');
    expect(listExercises).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(listExercises).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'squat', limit: 20 }),
      );
    });
    vi.useRealTimers();
  });

  it('applies desktop filters and restores them from the URL', async () => {
    const user = userEvent.setup();
    listExercises.mockResolvedValue(
      pageResponse([createExerciseListItem({ id: '1', name: 'Filtré' })]),
    );

    renderPage('/exercises?source=SYSTEM&favoriteOnly=true&muscleGroupId=muscle-chest');

    expect(await screen.findByText('Filtré')).toBeInTheDocument();
    expect(listExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'SYSTEM',
        favoriteOnly: true,
        muscleGroupId: 'muscle-chest',
      }),
    );

    // Desktop filters are in the DOM (hidden on mobile via CSS but still present).
    const measurement = screen.getByLabelText('Type de mesure');
    await user.selectOptions(measurement, 'DURATION');

    await waitFor(() => {
      expect(listExercises).toHaveBeenCalledWith(
        expect.objectContaining({
          measurementType: 'DURATION',
          source: 'SYSTEM',
          favoriteOnly: true,
        }),
      );
    });
  });

  it('shows empty filtered state and allows reset', async () => {
    const user = userEvent.setup();
    listExercises.mockResolvedValue(pageResponse([]));

    renderPage('/exercises?search=zzz');
    expect(
      await screen.findByText('Aucun exercice ne correspond à tes filtres.'),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Réinitialiser les filtres' })[0]!);
    await waitFor(() => {
      expect(listExercises).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined }),
      );
    });
  });

  it('shows an initial error with retry', async () => {
    const user = userEvent.setup();
    listExercises
      .mockRejectedValueOnce(new Error('API indisponible'))
      .mockResolvedValueOnce(pageResponse([createExerciseListItem({ name: 'Revenu' })]));

    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('API indisponible');

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Revenu')).toBeInTheDocument();
  });

  it('keeps loaded items when next page fails', async () => {
    const user = userEvent.setup();
    listExercises
      .mockResolvedValueOnce(
        pageResponse(
          [createExerciseListItem({ id: '1', name: 'Conservé' })],
          true,
          'c1',
        ),
      )
      .mockRejectedValueOnce(new Error('Suite indisponible'));

    renderPage();
    expect(await screen.findByText('Conservé')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Charger plus' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Suite indisponible');
    expect(screen.getByText('Conservé')).toBeInTheDocument();
  });

  it('navigates to detail from a card', async () => {
    listExercises.mockResolvedValue(
      pageResponse([createExerciseListItem({ id: 'ex-42', name: 'Tractions' })]),
    );

    renderPage();
    const link = await screen.findByRole('link', {
      name: 'Voir le détail de Tractions',
    });
    expect(link).toHaveAttribute('href', '/exercises/ex-42');
  });

  it('filters by equipment, measurement, source and archived', async () => {
    listExercises.mockResolvedValue(pageResponse([]));
    renderPage(
      '/exercises?equipmentTypeId=eq-barbell&measurementType=WEIGHT_REPS&source=USER&includeArchived=true',
    );

    await waitFor(() => {
      expect(listExercises).toHaveBeenCalledWith(
        expect.objectContaining({
          equipmentTypeId: 'eq-barbell',
          measurementType: 'WEIGHT_REPS',
          source: 'USER',
          includeArchived: true,
        }),
      );
    });

    expect(await screen.findByLabelText('Type d’équipement')).toBeInTheDocument();
    const panel = screen.getByLabelText('Type d’équipement').closest('div');
    expect(panel).toBeTruthy();
    // Ensure filter controls exist (desktop panel).
    expect(within(document.body).getByLabelText('Source')).toBeInTheDocument();
  });
});
