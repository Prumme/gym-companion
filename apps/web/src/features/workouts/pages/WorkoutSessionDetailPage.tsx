import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { workoutDetailQueryOptions } from '../api/workout-query-options';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { WorkoutProgressBanner } from '../components/WorkoutProgressBanner';
import { WorkoutSessionExerciseList } from '../components/WorkoutSessionExerciseList';
import {
  computeElapsedDurationMs,
  formatElapsedDuration,
} from '../lib/workout-elapsed-duration';
import { resolveHistoryBackPath } from '../lib/workout-history-filters';
import { getWorkoutStatusLabel } from '../lib/workout-labels';
import { computeWorkoutProgress } from '../lib/workout-progress';

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

export function WorkoutSessionDetailPage() {
  const { workoutSessionId = '' } = useParams();
  const location = useLocation();
  const backPath = resolveHistoryBackPath(location.state);
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const userId = meQuery.data?.data.id ?? null;
  const query = useQuery({
    ...workoutDetailQueryOptions(workoutSessionId, () => userId),
    enabled: Boolean(workoutSessionId) && (meQuery.isSuccess || meQuery.isError),
  });
  const fromLocal =
    useQuery({
      queryKey: workoutQueryKeys.detailFromLocal(workoutSessionId),
      queryFn: () => false,
      enabled: false,
      initialData: false,
    }).data === true;

  const session = query.data;
  const progress = useMemo(
    () => (session ? computeWorkoutProgress(session) : null),
    [session],
  );
  const elapsedMs = useMemo(
    () => (session ? computeElapsedDurationMs(session) : null),
    [session],
  );

  if (query.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-busy="true">
        <h1 className="text-2xl font-semibold">Séance</h1>
        <div className="h-24 animate-pulse rounded-[var(--radius)] bg-slate-100" />
        <div className="h-40 animate-pulse rounded-[var(--radius)] bg-slate-100" />
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as ApiRequestError | undefined)?.status;
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance</h1>
        <p className="text-sm text-[var(--danger)]" role="alert">
          {status === 404
            ? 'Séance introuvable.'
            : getApiErrorMessage(
                query.error,
                'Impossible de charger cette séance.',
              )}
        </p>
        <ButtonLink to={backPath} variant="secondary">
          Retour à l’historique
        </ButtonLink>
      </section>
    );
  }

  if (!session || !progress) {
    return null;
  }

  if (session.status === 'ACTIVE' || session.status === 'PAUSED') {
    return <Navigate to="/workouts/active" replace />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-[var(--muted)]" role="status">
          Statut : {getWorkoutStatusLabel(session.status)}
        </p>
        {fromLocal ? (
          <p className="text-xs font-medium text-amber-700" role="status">
            En attente de synchronisation
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold">{session.name}</h1>
        <dl className="grid gap-1 text-sm text-[var(--muted)]">
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
              Date locale :{' '}
            </dt>
            <dd className="inline">{session.localDate}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-[var(--foreground)]">
              Démarrée :{' '}
            </dt>
            <dd className="inline">
              {formatDateTime(session.startedAt, session.timezone)}
            </dd>
          </div>
          {session.completedAt ? (
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Terminée :{' '}
              </dt>
              <dd className="inline">
                {formatDateTime(session.completedAt, session.timezone)}
              </dd>
            </div>
          ) : null}
          {session.cancelledAt ? (
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Annulée :{' '}
              </dt>
              <dd className="inline">
                {formatDateTime(session.cancelledAt, session.timezone)}
              </dd>
            </div>
          ) : null}
          {elapsedMs != null ? (
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Durée écoulée :{' '}
              </dt>
              <dd className="inline">{formatElapsedDuration(elapsedMs)}</dd>
            </div>
          ) : null}
          {session.cancellationReason ? (
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Motif :{' '}
              </dt>
              <dd className="inline">{session.cancellationReason}</dd>
            </div>
          ) : null}
          {session.notes ? (
            <div>
              <dt className="inline font-medium text-[var(--foreground)]">
                Notes :{' '}
              </dt>
              <dd className="inline">{session.notes}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <h2 className="text-sm font-semibold">Progression finale</h2>
          <ul className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
            <li>
              {progress.totalExercises} exercice
              {progress.totalExercises === 1 ? '' : 's'}
            </li>
            <li>
              {progress.totalSets} série{progress.totalSets === 1 ? '' : 's'} au
              total
            </li>
            <li>
              {progress.recordedSets} traitée
              {progress.recordedSets === 1 ? '' : 's'}
            </li>
            <li>{progress.completedSets} terminée{progress.completedSets === 1 ? '' : 's'}</li>
            <li>{progress.partialSets} partielle{progress.partialSets === 1 ? '' : 's'}</li>
            <li>{progress.failedSets} échouée{progress.failedSets === 1 ? '' : 's'}</li>
            <li>{progress.skippedSets} ignorée{progress.skippedSets === 1 ? '' : 's'}</li>
            <li>
              {progress.pendingSets} non réalisée
              {progress.pendingSets === 1 ? '' : 's'}
            </li>
          </ul>
        </div>

        <WorkoutProgressBanner progress={progress} />
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={backPath} variant="secondary">
          Retour à l’historique
        </ButtonLink>
        <Link
          to="/planning"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-medium"
        >
          Planning
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Exercices</h2>
        <WorkoutSessionExerciseList
          session={session}
          effortTrackingMode="NONE"
          canRecordSets={false}
          highlightedSetId={null}
          onVersionConflict={() => undefined}
        />
      </div>
    </section>
  );
}
