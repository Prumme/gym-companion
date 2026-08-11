import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { GuestRoute } from '@/features/auth/components/GuestRoute';
import { useAuthStore } from '@/stores/auth-store';

function renderGuest(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<p>Login form</p>} />
          <Route path="/register" element={<p>Register form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuestRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authStatus: 'initializing',
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('affiche un loader pendant initializing', () => {
    renderGuest('/login');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Vérification de la session…',
    );
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('affiche le formulaire login quand unauthenticated', () => {
    useAuthStore.setState({
      authStatus: 'unauthenticated',
      accessToken: null,
      isAuthenticated: false,
    });
    renderGuest('/login');
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('redirige authenticated depuis /login vers /', () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderGuest('/login');
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('redirige authenticated depuis /register vers /', () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderGuest('/register');
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Register form')).not.toBeInTheDocument();
  });
});
