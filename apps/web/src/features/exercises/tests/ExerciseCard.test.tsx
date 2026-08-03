import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ExerciseCard } from '../components/ExerciseCard';
import { createExerciseListItem } from './fixtures';

describe('ExerciseCard', () => {
  it('renders a system exercise', () => {
    render(
      <MemoryRouter>
        <ExerciseCard exercise={createExerciseListItem()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Développé couché à la barre')).toBeInTheDocument();
    expect(screen.getByText(/Pectoraux/)).toBeInTheDocument();
    expect(screen.getByText('Système')).toBeInTheDocument();
    expect(screen.getByText('Poids et répétitions')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Voir le détail de Développé couché à la barre',
      }),
    ).toHaveAttribute('href', '/exercises/exercise-1');
    expect(screen.queryByText('Archivé')).not.toBeInTheDocument();
    expect(screen.queryByText('Favori')).not.toBeInTheDocument();
  });

  it('renders a personal exercise badge', () => {
    render(
      <MemoryRouter>
        <ExerciseCard
          exercise={createExerciseListItem({
            source: 'USER',
            name: 'Curl maison',
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Personnel')).toBeInTheDocument();
  });

  it('renders favorite state without an interactive control', () => {
    render(
      <MemoryRouter>
        <ExerciseCard
          exercise={createExerciseListItem({
            userPreference: {
              isFavorite: true,
              isExcludedFromSuggestions: false,
              preferredEquipmentType: null,
              restSecondsOverride: null,
            },
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Favori')).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: /favori/i })).not.toBeInTheDocument();
  });

  it('renders archived badge', () => {
    render(
      <MemoryRouter>
        <ExerciseCard
          exercise={createExerciseListItem({
            archivedAt: '2026-08-01T00:00:00.000Z',
          })}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Archivé')).toBeInTheDocument();
  });
});
