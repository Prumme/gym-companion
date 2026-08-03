import { Outlet } from 'react-router-dom';

import { PwaUpdateBanner } from '@/lib/pwa/PwaUpdateBanner';

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-8 pt-6">
      <header className="mb-8">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
          Gym Companion
        </p>
      </header>
      <PwaUpdateBanner />
      <Outlet />
    </div>
  );
}
