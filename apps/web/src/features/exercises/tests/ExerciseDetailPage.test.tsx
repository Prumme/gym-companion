import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseDetailPage } from '../pages/ExerciseDetailPage';
import { createExerciseListItem } from './fixtures';

const getExercise = vi.fn();

vi.mock('../api/exercise-api', () => ({
  getExercise: (...args: unknown[]) => getExercise(...args),
  listExercises: vi.fn(),
  listMuscleGroups: vi.fn(),
  listEquipmentTypes: vi.fn(),
}));

function renderDetail(id = 'exercise-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/exercises/${id}`]}>
        <Routes>
          <Route path="/exercises/:exerciseId" element={children} />
          <Route path="/exercises" element={<div>Catalogue</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(<ExerciseDetailPage />, { wrapper });
}

describe('ExerciseDetailPage', () => {
  beforeEach(() => {
    getExercise.mockReset();
  });

  it('renders read-only detail without edit actions', async () => {
    const item = createExerciseListItem();
    getExercise.mockResolvedValue({
      ...item,
      secondaryMuscleGroups: [
        { id: 't', code: 'triceps', name: 'Triceps', parentId: null },
      ],
      compatibleEquipmentTypes: [
        {
          equipmentType: { id: 'eq-barbell', code: 'barbell', name: 'Barre' },
          isPreferred: true,
          notes: null,
        },
      ],
      instructions: 'Contrôler la descente.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'Développé couché à la barre' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Triceps')).toBeInTheDocument();
    expect(screen.getByText('Contrôler la descente.')).toBeInTheDocument();
    expect(screen.getByText(/Lecture seule/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /favori/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retour au catalogue/i })).toBeInTheDocument();
  });

  it('shows inaccessible resource message', async () => {
    const error = Object.assign(new Error('Exercice introuvable.'), { status: 404 });
    getExercise.mockRejectedValue(error);

    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Exercice introuvable ou inaccessible.',
    );
  });
});
