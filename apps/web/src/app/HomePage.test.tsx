import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './pages/HomePage';

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

describe('HomePage', () => {
  it('renders the Gym Companion brand for guests', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole('heading', { name: 'Gym Companion' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Se connecter' }),
    ).toBeInTheDocument();
  });
});
