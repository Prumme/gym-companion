import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  nextSetHint?: string | null;
  /** CTA prioritaire pendant le repos (ex. Exercice suivant). */
  primaryActionLabel?: string | null;
  onPrimaryAction?: () => void;
};

/** Réserve documentaire : voir `--rest-timer-reserve` dans global.css. */
export const REST_TIMER_RESERVE_CSS_VAR = '--rest-timer-reserve';

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
  nextSetHint = null,
  primaryActionLabel = null,
  onPrimaryAction,
}: RestTimerProps) {
  const shellClass =
    'sticky bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]';

  if (justExpired) {
    return (
      <div className={shellClass} role="status" data-testid="rest-timer">
        <div className="mx-auto w-full max-w-md">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Repos
          </p>
          <p className="mt-1 text-center text-2xl font-semibold tabular-nums">
            Terminé
          </p>
          {nextSetHint ? (
            <p className="mt-1 text-center text-sm text-[var(--muted)]">
              Série suivante · {nextSetHint}
            </p>
          ) : null}
          {primaryActionLabel && onPrimaryAction ? (
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onDismissExpired}
            >
              Continuer
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!isRunning && !isPaused) {
    if (!canManualStart || !onManualStart) {
      return null;
    }
    return (
      <div className={shellClass} data-testid="rest-timer">
        <div className="mx-auto w-full max-w-md">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onManualStart}
          >
            Démarrer le repos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={shellClass}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      data-testid="rest-timer"
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {isPaused ? 'Repos en pause' : 'Repos'}
        </p>
        <p
          className={cn(
            'font-semibold tabular-nums tracking-tight',
            primaryActionLabel ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl',
          )}
        >
          {formatRestCountdown(remainingSeconds)}
        </p>

        <div className="flex w-full items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1 px-3"
            aria-label={`Retirer ${REST_TIMER_STEP_SECONDS} secondes`}
            onClick={() => onAdd(-REST_TIMER_STEP_SECONDS)}
          >
            −{REST_TIMER_STEP_SECONDS} s
          </Button>
          {isPaused ? (
            <Button
              type="button"
              className="min-h-11 flex-1 px-3"
              aria-label="Reprendre le repos"
              onClick={onResume}
            >
              Reprendre
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 flex-1 px-3"
              aria-label="Mettre le repos en pause"
              onClick={onPause}
            >
              Pause
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1 px-3"
            aria-label={`Ajouter ${REST_TIMER_STEP_SECONDS} secondes`}
            onClick={() => onAdd(REST_TIMER_STEP_SECONDS)}
          >
            +{REST_TIMER_STEP_SECONDS} s
          </Button>
        </div>

        {nextSetHint ? (
          <p className="text-center text-sm text-[var(--muted)]">
            Série suivante · {nextSetHint}
          </p>
        ) : null}

        {primaryActionLabel && onPrimaryAction ? (
          <Button type="button" className="w-full" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </Button>
        ) : null}

        <button
          type="button"
          className="min-h-11 text-sm font-medium text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="Passer le repos"
          onClick={onStop}
        >
          Passer le repos
        </button>
      </div>
    </div>
  );
}
