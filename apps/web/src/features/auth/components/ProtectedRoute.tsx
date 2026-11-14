import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { useAuthStore } from '@/stores/auth-store';

export function ProtectedRoute() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === 'initializing') {
    return <LoadingState label="Vérification de la session…" />;
  }

  if (authStatus === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
