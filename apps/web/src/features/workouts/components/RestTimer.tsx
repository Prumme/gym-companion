import { Button } from '@/components/ui/button';

import {
  formatRestCountdown,
  REST_TIMER_STEP_SECONDS,
} from '../lib/rest-timer-storage';

type RestTimerProps = {
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  justExpired: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onAdd: (delta: number) => void;
  onDismissExpired: () => void;
  onManualStart?: () => void;
  canManualStart?: boolean;
};

export function RestTimer({
  remainingSeconds,
  isRunning,
  isPaused,
  justExpired,
  onPause,
  onResume,
  onStop,
  onAdd,
  onDismissExpired,
  onManualStart,
  canManualStart = false,
}: RestTimerProps) {
  if (justExpired) {
    return (
      <div
        className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        role="status"
      >
        <p className="text-sm font-semibold">Repos terminé</p>
        <Button type="button" className="mt-2 w-full" onClick={onDismissExpired}>
          Fermer
        </Button>
      </div>
    );
  }

  if (!isRunning && !isPaused) {
    if (!canManualStart || !onManualStart) {
      return null;
    }
    return (
      <div className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] p-3">
        <Button type="button" variant="secondary" className="w-full" onClick={onManualStart}>
          Démarrer le repos
        </Button>
      </div>
    );
  }

  return (
    <div
      className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">
            {isPaused ? 'Repos en pause' : 'Repos'}
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {formatRestCountdown(remainingSeconds)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {isPaused ? (
            <Button
              type="button"
              aria-label="Reprendre le repos"
              onClick={onResume}
            >
              Reprendre
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              aria-label="Mettre le repos en pause"
              onClick={onPause}
            >
              Pause
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            aria-label="Arrêter le repos"
            onClick={onStop}
          >
            Arrêter
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={`Ajouter ${REST_TIMER_STEP_SECONDS} secondes`}
            onClick={() => onAdd(REST_TIMER_STEP_SECONDS)}
          >
            +{REST_TIMER_STEP_SECONDS} s
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={`Retirer ${REST_TIMER_STEP_SECONDS} secondes`}
            onClick={() => onAdd(-REST_TIMER_STEP_SECONDS)}
          >
            -{REST_TIMER_STEP_SECONDS} s
          </Button>
        </div>
      </div>
    </div>
  );
}
