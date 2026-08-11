import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router';
import { bootstrapSession } from '@/features/auth/api/auth-api';

export function App() {
  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
