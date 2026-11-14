import { Bell } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { RestEndSignalPreferences } from '../lib/rest-end-signal';
import { formatRestCountdown, REST_TIMER_STEP_SECONDS } from '../lib/rest-timer-storage';

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
  nextSetHint?: string | null;
  /** CTA prioritaire pendant le repos (ex. Exercice suivant). */
  primaryActionLabel?: string | null;
  onPrimaryAction?: () => void;
  /** Préférences locales du signal de fin (vibration / son). Réglage masqué si absent. */
  signalPreferences?: RestEndSignalPreferences;
  onSignalPreferenceChange?: (key: keyof RestEndSignalPreferences, value: boolean) => void;
  vibrationSupported?: boolean;
  soundSupported?: boolean;
};

type RestEndSignalSettingsProps = {
  preferences: RestEndSignalPreferences;
  onChange: (key: keyof RestEndSignalPreferences, value: boolean) => void;
  vibrationSupported: boolean;
  soundSupported: boolean;
};

function RestEndSignalSettings({
  preferences,
  onChange,
  vibrationSupported,
  soundSupported,
}: RestEndSignalSettingsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rowClass =
    'flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm';

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" aria-hidden="true" />
        Signal de fin
      </button>
      {open ? (
        <div id={panelId} className="flex w-full flex-col gap-2">
          <label className={rowClass}>
            <span>
              Vibration
              {!vibrationSupported ? (
                <span className="block text-xs text-[var(--muted)]">
                  Non disponible sur cet appareil
                </span>
              ) : null}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="size-5 accent-[var(--primary)]"
              checked={preferences.vibration}
              disabled={!vibrationSupported}
              onChange={(event) => onChange('vibration', event.target.checked)}
            />
          </label>
          <label className={rowClass}>
            <span>
              Son
              {!soundSupported ? (
                <span className="block text-xs text-[var(--muted)]">
                  Non disponible sur ce navigateur
                </span>
              ) : null}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="size-5 accent-[var(--primary)]"
              checked={preferences.sound}
              disabled={!soundSupported}
              onChange={(event) => onChange('sound', event.target.checked)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

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
  nextSetHint = null,
  primaryActionLabel = null,
  onPrimaryAction,
  signalPreferences,
  onSignalPreferenceChange,
  vibrationSupported = true,
  soundSupported = true,
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
          {/* Changement visuel de fin : pulsation brève, désactivée si prefers-reduced-motion. */}
          <p className="mt-1 text-center text-2xl font-semibold tabular-nums motion-safe:animate-pulse motion-safe:[animation-iteration-count:3]">
            Terminé
          </p>
          {nextSetHint ? (
            <p className="mt-1 text-center text-sm text-[var(--muted)]">
              Série suivante · {nextSetHint}
            </p>
          ) : null}
          {primaryActionLabel && onPrimaryAction ? (
            <Button type="button" className="mt-3 w-full" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          ) : (
            <Button type="button" className="mt-3 w-full" onClick={onDismissExpired}>
              Continuer
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!isRunning && !isPaused) {
    return null;
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
          <p className="text-center text-sm text-[var(--muted)]">Série suivante · {nextSetHint}</p>
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

        {signalPreferences && onSignalPreferenceChange ? (
          <RestEndSignalSettings
            preferences={signalPreferences}
            onChange={onSignalPreferenceChange}
            vibrationSupported={vibrationSupported}
            soundSupported={soundSupported}
          />
        ) : null}
      </div>
    </div>
  );
}
