import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  useArchiveProgramMutation,
  useRestoreProgramMutation,
} from '../hooks/use-program-mutations';
import { ConfirmDialog } from './ConfirmDialog';

type ProgramDangerZoneProps = {
  programId: string;
  isArchived: boolean;
  canArchive: boolean;
  canRestore: boolean;
  onStatus: (message: string) => void;
};

export function ProgramDangerZone({
  programId,
  isArchived,
  canArchive,
  canRestore,
  onStatus,
}: ProgramDangerZoneProps) {
  const archiveMutation = useArchiveProgramMutation();
  const restoreMutation = useRestoreProgramMutation();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setError(null);
    try {
      await archiveMutation.mutateAsync(programId);
      setArchiveOpen(false);
      onStatus('Programme archivé.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’archiver ce programme.'));
    }
  }

  async function handleRestore() {
    setError(null);
    try {
      await restoreMutation.mutateAsync(programId);
      onStatus('Programme restauré.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de restaurer ce programme.'),
      );
    }
  }

  if (!canArchive && !canRestore) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
        Zone sensible
      </h2>

      {canArchive && !isArchived ? (
        <>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => {
              setError(null);
              setArchiveOpen(true);
            }}
          >
            Archiver le programme
          </Button>
          <ConfirmDialog
            open={archiveOpen}
            title="Archiver ce programme ?"
            description="Le programme restera consultable, mais il ne pourra plus être modifié tant qu’il n’est pas restauré."
            confirmLabel="Archiver"
            destructive
            pending={archiveMutation.isPending}
            error={error}
            onConfirm={() => void handleArchive()}
            onCancel={() => setArchiveOpen(false)}
          />
        </>
      ) : null}

      {canRestore && isArchived ? (
        <div>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Ce programme est archivé. Restaure-le pour le modifier à nouveau.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={restoreMutation.isPending}
            onClick={() => void handleRestore()}
          >
            {restoreMutation.isPending
              ? 'Restauration…'
              : 'Restaurer le programme'}
          </Button>
          {error ? (
            <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
