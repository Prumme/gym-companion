import type { ExerciseDetail } from '@gym-companion/shared';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  useArchiveExerciseMutation,
  useRestoreExerciseMutation,
} from '../hooks/use-exercise-mutations';
import {
  canArchiveExercise,
  canEditExercise,
  canRestoreExercise,
} from '../lib/exercise-form';

type ExerciseManagementSectionProps = {
  exercise: ExerciseDetail;
  onStatus?: (message: string) => void;
};

export function ExerciseManagementSection({
  exercise,
  onStatus,
}: ExerciseManagementSectionProps) {
  const canEdit = canEditExercise(exercise.permissions);
  const canArchive = canArchiveExercise(exercise.permissions);
  const canRestore = canRestoreExercise(exercise.permissions);

  if (!canEdit && !canArchive && !canRestore) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
        Gestion de l’exercice
      </h2>

      {canEdit ? (
        <ButtonLink
          to={`/exercises/${exercise.id}/edit`}
          variant="secondary"
          className="mb-4 w-full sm:w-auto"
        >
          Modifier l’exercice
        </ButtonLink>
      ) : null}

      {canArchive ? (
        <ArchiveControls exercise={exercise} onStatus={onStatus} />
      ) : null}

      {canRestore ? (
        <RestoreControls exercise={exercise} onStatus={onStatus} />
      ) : null}
    </section>
  );
}

function ArchiveControls({
  exercise,
  onStatus,
}: {
  exercise: ExerciseDetail;
  onStatus?: (message: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const archiveMutation = useArchiveExerciseMutation();

  async function confirmArchive() {
    setError(null);
    try {
      await archiveMutation.mutateAsync(exercise.id);
      setConfirmOpen(false);
      onStatus?.('Exercice archivé.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible d’archiver cet exercice. Réessaie.'),
      );
    }
  }

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="mb-3 text-sm text-[var(--muted)]">Zone sensible</p>
      <Button
        type="button"
        variant="destructive"
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
      >
        Archiver l’exercice
      </Button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!archiveMutation.isPending) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-semibold">
              Archiver cet exercice ?
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Il disparaîtra du catalogue par défaut, mais pourra être restauré
              plus tard. Tes préférences seront conservées.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={archiveMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={archiveMutation.isPending}
                onClick={() => void confirmArchive()}
              >
                {archiveMutation.isPending ? 'Archivage…' : 'Archiver'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RestoreControls({
  exercise,
  onStatus,
}: {
  exercise: ExerciseDetail;
  onStatus?: (message: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const restoreMutation = useRestoreExerciseMutation();

  async function confirmRestore() {
    setError(null);
    try {
      await restoreMutation.mutateAsync(exercise.id);
      setConfirmOpen(false);
      onStatus?.('Exercice restauré.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de restaurer cet exercice. Réessaie.'),
      );
    }
  }

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="mb-2 text-sm text-[var(--muted)]">
        Cet exercice est archivé. Restaure-le pour le modifier à nouveau.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
      >
        Restaurer l’exercice
      </Button>
      <p className="mt-2 text-sm">
        <Link
          to="/exercises?includeArchived=true&source=USER"
          className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Voir les exercices archivés
        </Link>
      </p>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!restoreMutation.isPending) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-semibold">
              Restaurer cet exercice ?
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Il réapparaîtra dans le catalogue selon tes filtres.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={restoreMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={restoreMutation.isPending}
                onClick={() => void confirmRestore()}
              >
                {restoreMutation.isPending ? 'Restauration…' : 'Restaurer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
