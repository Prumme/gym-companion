import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { listPrograms } from '@/features/programs/api/program-api';
import { getApiErrorMessage } from '@/lib/api/client';

type CoachProposalProgramPickerSheetProps = {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (programId: string) => void;
};

/**
 * Jalon 8 — une proposition de type séance (`WORKOUT`) ne peut être acceptée
 * sans programme cible : un `WorkoutTemplate` appartient toujours à un
 * `Program`. L’utilisateur choisit explicitement ce programme ici.
 */
export function CoachProposalProgramPickerSheet({
  open,
  pending = false,
  error = null,
  onClose,
  onConfirm,
}: CoachProposalProgramPickerSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [programId, setProgramId] = useState('');

  const programsQuery = useQuery({
    queryKey: ['coach-proposal-program-picker'],
    queryFn: () => listPrograms({ limit: 50 }),
    enabled: open,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!open) return;
    setProgramId('');
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const programs = (programsQuery.data?.data ?? []).filter(
    (program) => program.permissions.canEdit,
  );

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-full md:max-w-md md:rounded-[var(--radius-surface)]"
        style={{
          paddingBottom:
            'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-3">
          <h2 id={titleId} className="section-title">
            Ajouter cette séance à…
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {programsQuery.isLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Chargement de tes programmes…
          </p>
        ) : null}

        {programsQuery.isError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {getApiErrorMessage(
              programsQuery.error,
              'Impossible de charger tes programmes.',
            )}
          </p>
        ) : null}

        {programsQuery.isSuccess && programs.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Tu n’as pas encore de programme modifiable. Crée un programme
              pour pouvoir y ajouter cette séance.
            </p>
            <Link
              to="/programs/new"
              className="text-sm font-medium underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Créer un programme
            </Link>
          </div>
        ) : null}

        {programs.length > 0 ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Programme cible</span>
              <select
                value={programId}
                onChange={(event) => setProgramId(event.target.value)}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                aria-label="Programme cible"
              >
                <option value="">Choisir…</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>

            {error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              disabled={pending || programId === ''}
              onClick={() => onConfirm(programId)}
              aria-busy={pending}
            >
              {pending ? 'Ajout en cours…' : 'Ajouter la séance'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
