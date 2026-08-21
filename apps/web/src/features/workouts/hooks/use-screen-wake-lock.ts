import { useEffect, useRef } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (
    type: 'release',
    listener: () => void,
    options?: { once?: boolean },
  ) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

function isWakeLockSupported(
  nav: Navigator,
): nav is WakeLockNavigator & {
  wakeLock: NonNullable<WakeLockNavigator['wakeLock']>;
} {
  return (
    'wakeLock' in nav &&
    typeof (nav as WakeLockNavigator).wakeLock?.request === 'function'
  );
}

function debugWakeLock(event: string): void {
  if (import.meta.env.DEV) {
    console.debug(`[screen-wake-lock] ${event}`);
  }
}

/**
 * Best-effort Screen Wake Lock pendant une séance Active Workout affichée.
 *
 * Décision V1 : le lock n’est demandé que lorsque l’UI Active Workout est
 * montée avec une séance ACTIVE|PAUSED. Quitter la page relâche le lock même
 * si la séance reste ouverte en base.
 */
export function useScreenWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const activeRef = useRef(active);
  const requestInFlightRef = useRef(false);
  activeRef.current = active;

  useEffect(() => {
    let cancelled = false;

    async function releaseSentinel(): Promise<void> {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (!sentinel || sentinel.released) return;
      try {
        await sentinel.release();
        debugWakeLock('wake_lock_released');
      } catch {
        // Non critique.
      }
    }

    async function acquire(): Promise<void> {
      if (cancelled || !activeRef.current) return;
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      if (!isWakeLockSupported(navigator)) {
        debugWakeLock('wake_lock_unavailable');
        return;
      }

      const existing = sentinelRef.current;
      if ((existing && !existing.released) || requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled || !activeRef.current) {
          try {
            await sentinel.release();
          } catch {
            // ignore
          }
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener(
          'release',
          () => {
            if (sentinelRef.current === sentinel) {
              sentinelRef.current = null;
            }
            debugWakeLock('wake_lock_released');
          },
          { once: true },
        );
        debugWakeLock('wake_lock_acquired');
      } catch {
        // Refuse navigateur / système : séance continue.
      } finally {
        requestInFlightRef.current = false;
      }
    }

    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible' && activeRef.current) {
        void acquire();
      }
    }

    if (active) {
      void acquire();
      document.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      void releaseSentinel();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void releaseSentinel();
    };
  }, [active]);
}
