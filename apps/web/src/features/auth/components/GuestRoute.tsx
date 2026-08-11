import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { resolvePostAuthPath } from '@/features/auth/lib/resolve-post-auth-path';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Routes réservées aux invités (/login, /register).
 * Un utilisateur déjà authentifié est renvoyé vers la destination d’origine ou `/`.
 */
export function GuestRoute() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === 'initializing') {
    return <LoadingState label="Vérification de la session…" />;
  }

  if (authStatus === 'authenticated') {
    return <Navigate to={resolvePostAuthPath(location.state)} replace />;
  }

  return <Outlet />;
}
