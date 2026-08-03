import { Navigate, Outlet } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isBootstrapping = useUiStore((state) => state.isBootstrapping);

  if (isBootstrapping) {
    return <LoadingState label="Vérification de la session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
