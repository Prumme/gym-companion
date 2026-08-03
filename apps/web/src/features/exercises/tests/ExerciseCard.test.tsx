import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseCard } from '../components/ExerciseCard';
import { createExerciseListItem } from './fixtures';

const updateExercisePreference = vi.fn();

vi.mock('../api/exercise-api', async () => {
  const actual = await vi.importActual<typeof import('../api/exercise-api')>(
    '../api/exercise-api',
  );
  return {
    ...actual,
    updateExercisePreference: (...args: unknown[]) =>
      updateExercisePreference(...args),
  };
});

function renderCard(
  exercise = createExerciseListItem(),
  onFeedback?: (message: string | null) => void,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/exercises']}>
        <Routes>
          <Route path="/exercises" element={children} />
          <Route path="/exercises/:exerciseId" element={<div>Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ExerciseCard exercise={exercise} onFeedback={onFeedback} />, {
    wrapper,
  });
}

describe('ExerciseCard favorites', () => {
  beforeEach(() => {
    updateExercisePreference.mockReset();
  });

  it('renders a non-favorite card with add action', () => {
    renderCard();
    expect(
      screen.getByRole('button', { name: 'Ajouter aux favoris' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders a favorite card with remove action', () => {
    renderCard(
      createExerciseListItem({
        userPreference: {
          isFavorite: true,
          isExcludedFromSuggestions: false,
          preferredEquipmentType: null,
          restSecondsOverride: null,
        },
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Retirer des favoris' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles favorite without navigating', async () => {
    const user = userEvent.setup();
    updateExercisePreference.mockResolvedValue({
      isFavorite: true,
      isExcludedFromSuggestions: false,
      preferredEquipmentType: null,
      restSecondsOverride: null,
    });

    renderCard();
    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

    await waitFor(() => {
      expect(updateExercisePreference).toHaveBeenCalledWith('exercise-1', {
        isFavorite: true,
        isExcludedFromSuggestions: false,
        preferredEquipmentTypeId: null,
        restSecondsOverride: null,
      });
    });
    expect(screen.queryByText('Detail')).not.toBeInTheDocument();
  });

  it('shows an error when favorite mutation fails', async () => {
    const user = userEvent.setup();
    const onFeedback = vi.fn();
    updateExercisePreference.mockRejectedValue(new Error('Network down'));

    renderCard(createExerciseListItem(), onFeedback);
    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(onFeedback).toHaveBeenCalledWith('Network down');
  });

  it('keeps detail navigation on the title link', () => {
    renderCard(createExerciseListItem({ id: 'ex-9', name: 'Squat' }));
    expect(
      screen.getByRole('link', { name: 'Voir le détail de Squat' }),
    ).toHaveAttribute('href', '/exercises/ex-9');
  });

  it('renders archived badge', () => {
    renderCard(
      createExerciseListItem({ archivedAt: '2026-08-01T00:00:00.000Z' }),
    );
    expect(screen.getByText('Archivé')).toBeInTheDocument();
  });
});
