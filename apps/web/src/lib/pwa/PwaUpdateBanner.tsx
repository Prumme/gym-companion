import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';

export function PwaUpdateBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!needRefresh && !offline) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
      {offline ? <p>Mode hors ligne : certaines actions peuvent être indisponibles.</p> : null}
      {needRefresh ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p>Une nouvelle version est disponible.</p>
          <Button
            type="button"
            onClick={() => {
              void updateServiceWorker(true);
              setNeedRefresh(false);
            }}
          >
            Mettre à jour
          </Button>
        </div>
      ) : null}
    </div>
  );
}
