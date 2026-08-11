import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { isFocusModePath } from '@/app/navigation/nav-config';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MoreMenuSheet } from '@/components/layout/MoreMenuSheet';
import { PwaUpdateBanner } from '@/lib/pwa/PwaUpdateBanner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const focusMode = isFocusModePath(location.pathname);
  const showChrome = isAuthenticated && !focusMode;
  const [moreOpen, setMoreOpen] = useState(false);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh w-full bg-[var(--background)]">
      {showChrome ? <AppSidebar pathname={location.pathname} /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'mx-auto flex w-full max-w-3xl flex-1 flex-col px-[var(--page-padding-inline)] pt-[var(--space-4)]',
            focusMode
              ? 'max-w-none px-[var(--page-padding-inline)] pt-[var(--space-3)] pb-0'
              : showChrome
                ? 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+var(--space-4))] md:pb-[var(--space-8)]'
                : 'pb-[var(--space-6)]',
          )}
        >
          <PwaUpdateBanner />
          <Outlet />
        </div>

        {showChrome ? (
          <>
            <BottomNavigation
              pathname={location.pathname}
              moreOpen={moreOpen}
              onOpenMore={() => setMoreOpen(true)}
            />
            <MoreMenuSheet
              open={moreOpen}
              onClose={closeMore}
              pathname={location.pathname}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
