import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { MoreHorizontal } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';

import { getWorkoutStatusLabel } from '../lib/workout-labels';
import type { WorkoutProgressSummary } from '../lib/workout-progress';
import { WorkoutProgressBanner } from './WorkoutProgressBanner';

function formatDateTime(value: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

type ActiveWorkoutHeaderProps = {
  session: WorkoutSessionDetail;
  progress: WorkoutProgressSummary;
  onPause?: () => void;
  onResume?: () => void;
  onOpenComplete?: () => void;
  onOpenCancel?: () => void;
  pausePending?: boolean;
  resumePending?: boolean;
  offline?: boolean;
};

export function ActiveWorkoutHeader({
  session,
  progress,
  onPause,
  onResume,
  onOpenComplete,
  onOpenCancel,
  pausePending = false,
  resumePending = false,
  offline = false,
}: ActiveWorkoutHeaderProps) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]" role="status">
            Statut : {getWorkoutStatusLabel(session.status)}
          </p>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <dl className="mt-1 grid gap-0.5 text-sm text-[var(--muted)]">
            {session.source.programName ? (
              <div>
                <dt className="inline font-medium text-[var(--foreground)]">
                  Programme :{' '}
                </dt>
                <dd className="inline">{session.source.programName}</dd>
              </div>
            ) : null}
            {session.source.workoutTemplateName ? (
              <div>
                <dt className="inline font-medium text-[var(--foreground)]">
                  Modèle :{' '}
                </dt>
                <dd className="inline">{session.source.workoutTemplateName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Date :{' '}
              </dt>
              <dd className="inline">{session.localDate}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Début :{' '}
              </dt>
              <dd className="inline">
                {formatDateTime(session.startedAt, session.timezone)}
              </dd>
            </div>
            {session.pausedAt ? (
              <div>
                <dt className="inline font-medium text-[var(--foreground)]">
                  Pause :{' '}
                </dt>
                <dd className="inline">
                  {formatDateTime(session.pausedAt, session.timezone)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="relative flex shrink-0 flex-col items-end gap-2">
          {session.permissions.canPause && onPause ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pausePending || offline}
              onClick={onPause}
            >
              {pausePending ? 'Pause…' : 'Mettre en pause'}
            </Button>
          ) : null}
          {session.permissions.canResume && onResume ? (
            <Button
              type="button"
              disabled={resumePending || offline}
              onClick={onResume}
            >
              {resumePending ? 'Reprise…' : 'Reprendre la séance'}
            </Button>
          ) : null}
          {(session.permissions.canComplete || session.permissions.canCancel) &&
          (onOpenComplete || onOpenCancel) ? (
            <>
              <Button
                type="button"
                variant="secondary"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-label="Autres actions de séance"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
              {menuOpen ? (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
                >
                  {session.permissions.canComplete && onOpenComplete ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2 text-left text-sm hover:bg-[var(--background)]"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenComplete();
                      }}
                    >
                      Terminer la séance
                    </button>
                  ) : null}
                  {session.permissions.canCancel && onOpenCancel ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--background)]"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenCancel();
                      }}
                    >
                      Annuler la séance
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <WorkoutProgressBanner progress={progress} />
    </header>
  );
}
