import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { StoredWorkoutCommand } from '../offline/types';

const COMMAND_LABELS: Record<StoredWorkoutCommand['type'], string> = {
  UPDATE_WORKOUT_SET: 'Mise à jour de série',
  PAUSE_WORKOUT: 'Mise en pause',
  RESUME_WORKOUT: 'Reprise',
  COMPLETE_WORKOUT: 'Fin de séance',
  CANCEL_WORKOUT: 'Annulation',
};

type WorkoutConflictPanelProps = {
  pendingCount: number;
  conflictCommand: StoredWorkoutCommand | null;
  serverCompletedOrCancelled?: boolean;
  onKeepServer: () => Promise<void>;
  onReapplyLocal: () => Promise<
    | { ok: true; session: unknown; commandCount: number }
    | { ok: false; reason: string; failedCommandId: string | null }
  >;
};

export function WorkoutConflictPanel({
  pendingCount,
  conflictCommand,
  serverCompletedOrCancelled = false,
  onKeepServer,
  onReapplyLocal,
}: WorkoutConflictPanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmKeep, setConfirmKeep] = useState(false);

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--danger)] bg-[var(--card)] p-4"
      role="alert"
    >
      <h2 className="text-lg font-semibold">Conflit de synchronisation</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {pendingCount} modification
        {pendingCount > 1 ? 's' : ''} locale
        {pendingCount > 1 ? 's' : ''} non synchronisée
        {pendingCount > 1 ? 's' : ''}.
      </p>
      {conflictCommand ? (
        <dl className="mt-3 grid gap-1 text-sm">
          <div>
            <dt className="inline font-medium">Type : </dt>
            <dd className="inline">
              {COMMAND_LABELS[conflictCommand.type]}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Date locale : </dt>
            <dd className="inline">
              {new Date(conflictCommand.createdAt).toLocaleString('fr-FR')}
            </dd>
          </div>
          {conflictCommand.errorMessage ? (
            <div>
              <dt className="inline font-medium">Message : </dt>
              <dd className="inline">{conflictCommand.errorMessage}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {message ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setConfirmKeep(true)}
        >
          Conserver la version du serveur
        </Button>
        {!serverCompletedOrCancelled ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setMessage(null);
              void onReapplyLocal()
                .then((result) => {
                  if (!result.ok) {
                    setMessage(result.reason);
                  }
                })
                .finally(() => setBusy(false));
            }}
          >
            Réappliquer mes changements
          </Button>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            La séance est terminée ou annulée à distance. Seule la conservation
            de la version serveur est possible.
          </p>
        )}
      </div>

      {confirmKeep ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setConfirmKeep(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm">
              Les modifications non synchronisées de cette séance seront
              abandonnées.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmKeep(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onKeepServer().finally(() => {
                    setBusy(false);
                    setConfirmKeep(false);
                  });
                }}
              >
                Abandonner mes modifications
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
