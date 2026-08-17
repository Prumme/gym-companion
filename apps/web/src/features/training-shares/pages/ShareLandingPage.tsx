import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { useAuthStore } from '@/stores/auth-store';

import { getSharePreview } from '../api/training-share-api';
import { ImportDestinationSheet } from '../components/ImportDestinationSheet';
import { useImportShareMutation } from '../hooks/use-training-share-mutations';
import {
  formatRemainingShareTime,
  formatShareSetsLine,
  getTrainingShareErrorMessage,
} from '../lib/share-format';

export function ShareLandingPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.authStatus);
  const importMutation = useImportShareMutation();

  const [destinationOpen, setDestinationOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedProgramId, setImportedProgramId] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const previewQuery = useQuery({
    queryKey: ['training-share-preview', token],
    queryFn: () => getSharePreview(token),
    enabled: Boolean(token),
    retry: false,
  });

  const remainingLabel = useMemo(() => {
    if (!previewQuery.data?.expiresAt) return null;
    return formatRemainingShareTime(previewQuery.data.expiresAt);
  }, [previewQuery.data?.expiresAt]);

  function requireAuthThen(action: () => void) {
    if (authStatus !== 'authenticated') {
      void navigate('/login', {
        state: { from: { pathname: `/share/${token}` } },
      });
      return;
    }
    action();
  }

  async function handleImportProgram() {
    setImportError(null);
    try {
      const result = await importMutation.mutateAsync({ token, body: {} });
      setImportedProgramId(result.programId);
      setSuccessMessage('Programme ajouté');
    } catch (err) {
      setImportError(
        getTrainingShareErrorMessage(err, 'Impossible d’ajouter ce programme.'),
      );
    }
  }

  async function handleImportWorkout(body: {
    type: 'NEW_PROGRAM' | 'EXISTING_PROGRAM';
    programId?: string;
    programName?: string;
  }) {
    setImportError(null);
    try {
      const result = await importMutation.mutateAsync({
        token,
        body: {
          destination:
            body.type === 'NEW_PROGRAM'
              ? { type: 'NEW_PROGRAM', programName: body.programName! }
              : { type: 'EXISTING_PROGRAM', programId: body.programId! },
        },
      });
      setDestinationOpen(false);
      setImportedProgramId(result.programId);
      setSuccessMessage('Séance ajoutée');
    } catch (err) {
      setImportError(
        getTrainingShareErrorMessage(err, 'Impossible d’ajouter cette séance.'),
      );
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
        <EmptyState
          title="Lien invalide"
          description="Ce lien de partage n’est pas valide."
        />
      </main>
    );
  }

  if (previewQuery.isLoading || authStatus === 'initializing') {
    return <LoadingState label="Chargement du partage…" />;
  }

  if (previewQuery.isError) {
    const message = getTrainingShareErrorMessage(
      previewQuery.error,
      'Ce lien de partage n’est pas valide.',
    );
    const expired =
      previewQuery.error &&
      typeof previewQuery.error === 'object' &&
      'code' in previewQuery.error &&
      (previewQuery.error as { code?: string }).code === 'SHARE_LINK_EXPIRED';

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
        <EmptyState
          title={expired ? 'Lien expiré' : 'Lien invalide'}
          description={
            expired
              ? 'Ce lien de partage a expiré. Les liens Gym Companion sont valides pendant 1 heure. Demande à la personne de générer un nouveau lien.'
              : message
          }
        />
        <ButtonLink to="/programs" variant="secondary">
          Voir mes programmes
        </ButtonLink>
      </main>
    );
  }

  const data = previewQuery.data!;
  const preview = data.preview;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {preview.kind === 'PROGRAM' ? 'Programme partagé' : 'Séance partagée'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {preview.name}
        </h1>
        {preview.kind === 'PROGRAM' && preview.description ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{preview.description}</p>
        ) : null}
        {remainingLabel ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ce lien expire dans {remainingLabel}
          </p>
        ) : null}
      </header>

      {successMessage && importedProgramId ? (
        <div
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950"
          role="status"
        >
          <p className="font-medium">{successMessage}</p>
          <ButtonLink
            to={`/programs/${importedProgramId}`}
            className="mt-2"
          >
            Voir le programme
          </ButtonLink>
        </div>
      ) : null}

      {preview.kind === 'PROGRAM' ? (
        <section className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            {preview.workoutCount} séance
            {preview.workoutCount === 1 ? '' : 's'}
          </p>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {preview.workouts.map((workout) => {
              const key = workout.name;
              const isOpen = expanded[key] ?? false;
              return (
                <li key={key} className="py-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [key]: !isOpen }))
                    }
                  >
                    <span>
                      <span className="block font-medium">{workout.name}</span>
                      <span className="text-sm text-[var(--muted)]">
                        {workout.exerciseCount} exercice
                        {workout.exerciseCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {isOpen ? 'Replier' : 'Détails'}
                    </span>
                  </button>
                  {isOpen ? (
                    <ul className="mt-3 space-y-2 pl-1">
                      {workout.exercises.map((exercise) => (
                        <li key={exercise.exerciseId} className="text-sm">
                          <span className="font-medium">{exercise.name}</span>
                          <span className="text-[var(--muted)]">
                            {' '}
                            · {formatShareSetsLine(exercise.sets)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section>
          <ul className="space-y-3">
            {preview.exercises.map((exercise) => (
              <li
                key={exercise.exerciseId}
                className="border-b border-[var(--border)] pb-3"
              >
                <p className="font-medium">{exercise.name}</p>
                <p className="text-sm text-[var(--muted)]">
                  {formatShareSetsLine(exercise.sets)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {importError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {importError}
        </p>
      ) : null}

      {!importedProgramId ? (
        <div className="flex flex-col gap-2">
          {preview.kind === 'PROGRAM' ? (
            <Button
              type="button"
              disabled={importMutation.isPending}
              onClick={() =>
                requireAuthThen(() => {
                  void handleImportProgram();
                })
              }
            >
              {importMutation.isPending
                ? 'Ajout…'
                : 'Ajouter à mes programmes'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={importMutation.isPending}
              onClick={() =>
                requireAuthThen(() => {
                  setDestinationOpen(true);
                })
              }
            >
              Ajouter cette séance
            </Button>
          )}
          {authStatus !== 'authenticated' ? (
            <p className="text-center text-sm text-[var(--muted)]">
              <Link
                to="/login"
                state={{ from: { pathname: `/share/${token}` } }}
                className="underline"
              >
                Connecte-toi
              </Link>{' '}
              pour importer.
            </p>
          ) : null}
        </div>
      ) : null}

      {preview.kind === 'WORKOUT_TEMPLATE' ? (
        <ImportDestinationSheet
          open={destinationOpen}
          onClose={() => setDestinationOpen(false)}
          workoutName={preview.name}
          busy={importMutation.isPending}
          error={importError}
          onImportExisting={(programId) => {
            void handleImportWorkout({
              type: 'EXISTING_PROGRAM',
              programId,
            });
          }}
          onImportNew={(programName) => {
            void handleImportWorkout({
              type: 'NEW_PROGRAM',
              programName,
            });
          }}
        />
      ) : null}
    </main>
  );
}
