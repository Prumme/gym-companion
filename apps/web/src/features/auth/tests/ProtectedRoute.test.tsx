import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { useAuthStore } from '@/stores/auth-store';

function renderProtected(initialPath = '/planning') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Login form</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/planning" element={<p>Planning page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authStatus: 'initializing',
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('affiche un loader pendant initializing sans rediriger vers login', () => {
    renderProtected('/planning');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Vérification de la session…',
    );
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
    expect(screen.queryByText('Planning page')).not.toBeInTheDocument();
  });

  it('affiche la page protégée quand authenticated', () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      accessToken: 'token',
      isAuthenticated: true,
    });
    renderProtected('/planning');
    expect(screen.getByText('Planning page')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('redirige vers /login quand unauthenticated', () => {
    useAuthStore.setState({
      authStatus: 'unauthenticated',
      accessToken: null,
      isAuthenticated: false,
    });
    renderProtected('/planning');
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(screen.queryByText('Planning page')).not.toBeInTheDocument();
  });
});
