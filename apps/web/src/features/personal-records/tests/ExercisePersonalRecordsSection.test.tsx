import type { PersonalRecord } from '@gym-companion/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseDetailPage } from '@/features/exercises/pages/ExerciseDetailPage';
import { createExerciseListItem } from '@/features/exercises/tests/fixtures';

const { getExercise, listExercisePersonalRecords } = vi.hoisted(() => ({
  getExercise: vi.fn(),
  listExercisePersonalRecords: vi.fn(),
}));

vi.mock('@/features/exercises/api/exercise-api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/exercises/api/exercise-api')
  >('@/features/exercises/api/exercise-api');
  return {
    ...actual,
    getExercise: (...args: unknown[]) => getExercise(...args),
    updateExercisePreference: vi.fn(),
    resetExercisePreference: vi.fn(),
    archiveExercise: vi.fn(),
    restoreExercise: vi.fn(),
  };
});

vi.mock('../api/personal-records-api', () => ({
  listExercisePersonalRecords: (...args: unknown[]) =>
    listExercisePersonalRecords(...args),
  listPersonalRecords: vi.fn(),
}));

function createDetail(overrides: Record<string, unknown> = {}) {
  const base = createExerciseListItem();
  return {
    ...base,
    secondaryMuscleGroups: [],
    compatibleEquipmentTypes: [],
    instructions: 'Contrôler.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function record(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    exerciseId: 'exercise-1',
    exercise: {
      id: 'exercise-1',
      name: 'Développé',
      measurementType: 'WEIGHT_REPS',
      archived: false,
    },
    equipment: { id: 'eq-1', name: 'Barre' },
    recordType: 'MAX_WEIGHT',
    value: 100,
    context: {
      weightKg: 100,
      reps: 5,
      durationSeconds: null,
      distanceMeters: null,
      rir: null,
      rpe: null,
      reachedFailure: false,
      setType: 'WORKING',
    },
    achievedOn: '2026-08-10',
    achievedAt: null,
    source: {
      workoutSessionId: 'ws-1',
      workoutSessionExerciseId: 'wse-1',
      workoutSetId: 'set-1',
    },
    ...overrides,
  };
}

function renderDetail(id = 'exercise-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/exercises/${id}`]}>
        <Routes>
          <Route path="/exercises/:exerciseId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ExerciseDetailPage />, { wrapper });
}

describe('Exercise detail personal records section', () => {
  beforeEach(() => {
    getExercise.mockReset();
    listExercisePersonalRecords.mockReset();
    getExercise.mockResolvedValue(createDetail({ id: 'exercise-1' }));
  });

  it('affiche les records de l’exercice courant', async () => {
    listExercisePersonalRecords.mockResolvedValue([
      record(),
      record({
        recordType: 'MAX_REPS',
        value: 12,
        source: {
          workoutSessionId: 'ws-2',
          workoutSessionExerciseId: 'wse-1',
          workoutSetId: 'set-2',
        },
      }),
    ]);
    renderDetail();
    expect(
      await screen.findByRole('heading', { name: 'Records personnels' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Charge maximale')).toBeInTheDocument();
    expect(screen.getByText('Répétitions maximales')).toBeInTheDocument();
    expect(listExercisePersonalRecords).toHaveBeenCalledWith('exercise-1');
  });

  it('affiche un message discret sans record', async () => {
    listExercisePersonalRecords.mockResolvedValue([]);
    renderDetail();
    expect(
      await screen.findByText('Aucun record enregistré pour cet exercice.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voir ma progression' }),
    ).toHaveAttribute('href', '/progress/exercises/exercise-1');
  });

  it('reste visible pour un exercice archivé', async () => {
    getExercise.mockResolvedValue(
      createDetail({
        id: 'exercise-1',
        archivedAt: '2026-08-01T00:00:00.000Z',
      }),
    );
    listExercisePersonalRecords.mockResolvedValue([record()]);
    renderDetail();
    expect(await screen.findByText('Archivé')).toBeInTheDocument();
    expect(await screen.findByText('Charge maximale')).toBeInTheDocument();
  });

  it('gère une erreur API des records sans bloquer le détail', async () => {
    listExercisePersonalRecords.mockRejectedValue(new Error('records down'));
    renderDetail();
    expect(await screen.findByText(/Contrôler/)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('ne mélange pas un autre exercice', async () => {
    listExercisePersonalRecords.mockImplementation(async (id: string) => {
      if (id !== 'exercise-1') {
        return [record({ exerciseId: id, value: 999 })];
      }
      return [record({ value: 100 })];
    });
    renderDetail('exercise-1');
    await waitFor(() => {
      expect(listExercisePersonalRecords).toHaveBeenCalledWith('exercise-1');
    });
    expect(await screen.findByText('100 kg')).toBeInTheDocument();
    expect(screen.queryByText('999 kg')).not.toBeInTheDocument();
  });
});
