import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router';
import { bootstrapSession } from '@/features/auth/api/auth-api';
import { useUiStore } from '@/stores/ui-store';

export function App() {
  const setBootstrapping = useUiStore((state) => state.setBootstrapping);

  useEffect(() => {
    let cancelled = false;
    setBootstrapping(true);
    void bootstrapSession().finally(() => {
      if (!cancelled) {
        setBootstrapping(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setBootstrapping]);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
