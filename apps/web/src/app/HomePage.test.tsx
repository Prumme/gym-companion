import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { HomePage } from './pages/HomePage';

describe('HomePage', () => {
  it('renders the Gym Companion brand', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Gym Companion' })).toBeInTheDocument();
  });
});
