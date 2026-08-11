import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { MoreHorizontal, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  currentExerciseIndex: number;
  totalExercises: number;
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
  currentExerciseIndex,
  totalExercises,
  onPause,
  onResume,
  onOpenComplete,
  onOpenCancel,
  pausePending = false,
  resumePending = false,
  offline = false,
}: ActiveWorkoutHeaderProps) {
  const menuId = useId();
  const detailsTitleId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const exercisePercent =
    totalExercises === 0
      ? 0
      : Math.round(((currentExerciseIndex + 1) / totalExercises) * 100);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 -mx-4 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-2.5 backdrop-blur-sm sm:mx-0 sm:rounded-[var(--radius)] sm:border',
        )}
      >
        <div className="flex items-center gap-2">
          <Link
            to="/training"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--foreground)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label="Quitter la séance sans la terminer"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>

          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-tight">
            {session.name}
          </h1>

          <div className="relative shrink-0" ref={menuRef}>
            <Button
              type="button"
              variant="ghost"
              className="size-11 min-h-11 px-0"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label="Actions de séance"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </Button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 top-full z-40 mt-1 min-w-[14rem] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]"
                  onClick={() => {
                    setMenuOpen(false);
                    setDetailsOpen(true);
                  }}
                >
                  Détails de la séance
                </button>
                {session.permissions.canPause && onPause ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pausePending || offline}
                    className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)] disabled:opacity-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onPause();
                    }}
                  >
                    {pausePending ? 'Pause…' : 'Mettre en pause'}
                  </button>
                ) : null}
                {session.permissions.canResume && onResume ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={resumePending || offline}
                    className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)] disabled:opacity-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onResume();
                    }}
                  >
                    {resumePending ? 'Reprise…' : 'Reprendre la séance'}
                  </button>
                ) : null}
                {session.permissions.canComplete && onOpenComplete ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]"
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
                    className="block w-full rounded-[calc(var(--radius)-2px)] px-3 py-2.5 text-left text-sm text-[var(--danger)] hover:bg-[var(--background)]"
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
          </div>
        </div>

        {totalExercises > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-center text-xs tabular-nums text-[var(--muted)]">
              {currentExerciseIndex + 1} / {totalExercises} exercices
            </p>
            <div
              className="h-1 overflow-hidden rounded-full bg-[var(--border)]"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
                style={{ width: `${exercisePercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <WorkoutProgressBanner
          progress={progress}
          showExercises={false}
          className="mt-2 flex flex-col gap-1"
        />
      </header>

      {detailsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailsTitleId}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-lg,1rem)] border border-[var(--border)] bg-[var(--card)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg sm:rounded-[var(--radius)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={detailsTitleId} className="text-lg font-semibold">
              Détails de la séance
            </h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Statut</dt>
                <dd>{getWorkoutStatusLabel(session.status)}</dd>
              </div>
              {session.source.programName ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Programme</dt>
                  <dd className="text-right">{session.source.programName}</dd>
                </div>
              ) : null}
              {session.source.workoutTemplateName ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Modèle</dt>
                  <dd className="text-right">
                    {session.source.workoutTemplateName}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Date</dt>
                <dd>{session.localDate}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Début</dt>
                <dd>
                  {formatDateTime(session.startedAt, session.timezone)}
                </dd>
              </div>
              {session.pausedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Pause</dt>
                  <dd>
                    {formatDateTime(session.pausedAt, session.timezone)}
                  </dd>
                </div>
              ) : null}
            </dl>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setDetailsOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
