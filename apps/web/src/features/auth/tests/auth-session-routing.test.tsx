import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GuestRoute } from '@/features/auth/components/GuestRoute';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/features/auth/api/auth-api', () => ({
  bootstrapSession: vi.fn(),
}));

function AuthApp({ initialPath }: { initialPath: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<p>Login form</p>} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/planning" element={<p>Planning page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('auth session routing', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authStatus: 'initializing',
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('URL initiale /planning + session valide → reste sur /planning sans Login', async () => {
    render(<AuthApp initialPath="/planning" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.getState().setSession('token');
    });

    await waitFor(() => {
      expect(screen.getByText('Planning page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('URL initiale /planning + session absente → /login', async () => {
    render(<AuthApp initialPath="/planning" />);
    act(() => {
      useAuthStore.getState().clearSession();
    });

    await waitFor(() => {
      expect(screen.getByText('Login form')).toBeInTheDocument();
    });
    expect(screen.queryByText('Planning page')).not.toBeInTheDocument();
  });

  it('refresh /login + session valide → / (pas de formulaire)', async () => {
    render(<AuthApp initialPath="/login" />);
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.getState().setSession('token');
    });

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });
});
