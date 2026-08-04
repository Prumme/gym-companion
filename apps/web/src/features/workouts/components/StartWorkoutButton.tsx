import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/programs/components/ConfirmDialog';

import {
  useStartWorkoutSession,
  type StartWorkoutConflict,
} from '../hooks/use-start-workout-session';

type StartWorkoutButtonProps = {
  sourceWorkoutTemplateId: string;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function StartWorkoutButton({
  sourceWorkoutTemplateId,
  label = 'Démarrer',
  className,
  disabled = false,
}: StartWorkoutButtonProps) {
  const start = useStartWorkoutSession();

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={className}
        disabled={disabled || start.pending}
        onClick={() => {
          void start.requestStart(sourceWorkoutTemplateId);
        }}
      >
        {label}
      </Button>

      <ConfirmDialog
        open={start.confirmOpen}
        title="Démarrer cette séance ?"
        description="Une copie figée du modèle sera créée. Les modifications futures du programme n’affecteront pas cette séance."
        confirmLabel="Démarrer"
        pending={start.pending}
        error={start.error}
        onConfirm={() => {
          void start.confirmStart();
        }}
        onCancel={start.cancelConfirm}
      />

      {start.pendingTerminal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={start.dismissConflict}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Synchronisation requise</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              La fin de cette séance doit encore être synchronisée.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void start.syncPendingTerminal();
                }}
              >
                Synchroniser maintenant
              </Button>
              <Button type="button" onClick={start.openActiveSession}>
                Ouvrir la séance
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {start.error && !start.confirmOpen && !start.pendingTerminal ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {start.error}
        </p>
      ) : null}

      <ActiveWorkoutConflictDialog
        conflict={start.conflict}
        onOpen={start.openActiveSession}
        onDismiss={start.dismissConflict}
      />
    </>
  );
}

function ActiveWorkoutConflictDialog({
  conflict,
  onOpen,
  onDismiss,
}: {
  conflict: StartWorkoutConflict | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  if (!conflict) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="active-workout-conflict-title"
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="active-workout-conflict-title"
          className="text-lg font-semibold"
        >
          Séance déjà en cours
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{conflict.message}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onDismiss}>
            Fermer
          </Button>
          <Button type="button" onClick={onOpen}>
            Ouvrir la séance en cours
          </Button>
        </div>
      </div>
    </div>
  );
}
