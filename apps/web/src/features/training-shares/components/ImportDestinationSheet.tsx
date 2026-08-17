import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { suggestProgramNameFromWorkoutTemplate } from '@gym-companion/validation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listPrograms } from '@/features/programs/api/program-api';
import { programQueryKeys } from '@/features/programs/api/program-query-keys';

type ImportDestinationSheetProps = {
  open: boolean;
  onClose: () => void;
  workoutName: string;
  busy: boolean;
  error: string | null;
  onImportExisting: (programId: string) => void;
  onImportNew: (programName: string) => void;
};

export function ImportDestinationSheet({
  open,
  onClose,
  workoutName,
  busy,
  error,
  onImportExisting,
  onImportNew,
}: ImportDestinationSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<'NEW_PROGRAM' | 'EXISTING_PROGRAM'>(
    'NEW_PROGRAM',
  );
  const [programName, setProgramName] = useState(
    suggestProgramNameFromWorkoutTemplate(workoutName),
  );
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  const programsQuery = useQuery({
    queryKey: programQueryKeys.lists(),
    queryFn: () => listPrograms({ limit: 50 }),
    enabled: open,
  });

  const editablePrograms = useMemo(
    () =>
      (programsQuery.data?.data ?? []).filter(
        (item) => item.archivedAt == null && item.permissions.canEdit,
      ),
    [programsQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setMode('NEW_PROGRAM');
    setProgramName(suggestProgramNameFromWorkoutTemplate(workoutName));
    setSelectedProgramId('');
  }, [open, workoutName]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const canSubmit =
    !busy &&
    (mode === 'NEW_PROGRAM'
      ? programName.trim().length > 0
      : Boolean(selectedProgramId));

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Où veux-tu ajouter cette séance ?
          </h2>
          <button
            ref={closeRef}
            type="button"
            disabled={busy}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface)] disabled:opacity-50"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-3" disabled={busy}>
          <legend className="sr-only">Destination</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3">
            <input
              type="radio"
              name="share-destination"
              checked={mode === 'NEW_PROGRAM'}
              onChange={() => setMode('NEW_PROGRAM')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Nouveau programme</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                Crée un programme inactif avec cette séance
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3">
            <input
              type="radio"
              name="share-destination"
              checked={mode === 'EXISTING_PROGRAM'}
              onChange={() => setMode('EXISTING_PROGRAM')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                Programme existant
              </span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                Ajoute la séance à un programme déjà créé
              </span>
            </span>
          </label>
        </fieldset>

        {mode === 'NEW_PROGRAM' ? (
          <div className="mt-4">
            <Input
              id="share-new-program-name"
              label="Nom du programme"
              className="mt-1.5"
              value={programName}
              disabled={busy}
              onChange={(event) => setProgramName(event.target.value)}
            />
          </div>
        ) : (
          <div className="mt-4">
            <label
              htmlFor="share-existing-program"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Programme
            </label>
            {programsQuery.isLoading ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Chargement…</p>
            ) : editablePrograms.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Aucun programme éditable. Choisis « Nouveau programme ».
              </p>
            ) : (
              <select
                id="share-existing-program"
                className="mt-1.5 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={selectedProgramId}
                disabled={busy}
                onChange={(event) => setSelectedProgramId(event.target.value)}
              >
                <option value="">Sélectionner…</option>
                {editablePrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            className="sm:flex-1"
            disabled={!canSubmit}
            onClick={() => {
              if (mode === 'NEW_PROGRAM') {
                onImportNew(programName.trim());
              } else if (selectedProgramId) {
                onImportExisting(selectedProgramId);
              }
            }}
          >
            {busy
              ? 'Ajout…'
              : mode === 'NEW_PROGRAM'
                ? 'Créer et ajouter la séance'
                : 'Ajouter'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:flex-1"
            disabled={busy}
            onClick={onClose}
          >
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
