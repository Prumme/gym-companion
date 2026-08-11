import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { workoutDetailQueryOptions } from '../api/workout-query-options';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { WorkoutSessionExerciseList } from '../components/WorkoutSessionExerciseList';
import { WorkoutSessionSummary } from '../components/WorkoutSessionSummary';
import {
  computeElapsedDurationMs,
  formatElapsedDuration,
} from '../lib/workout-elapsed-duration';
import { resolveHistoryBackPath } from '../lib/workout-history-filters';
import { getWorkoutStatusLabel } from '../lib/workout-labels';
import { computeWorkoutProgress } from '../lib/workout-progress';

function formatSessionDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  if (!year || !month || !day) return localDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const elapsedLabel =
    elapsedMs != null ? formatElapsedDuration(elapsedMs) : null;

  if (query.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-busy="true">
        <PageHeader title="Séance" backTo={backPath} backLabel="Historique" />
        <div className="h-24 animate-pulse rounded-[var(--radius)] bg-[var(--border)]/60" />
        <div className="h-40 animate-pulse rounded-[var(--radius)] bg-[var(--border)]/60" />
      </section>
    );
  }

  if (query.isError) {
    const status = (query.error as ApiRequestError | undefined)?.status;
    return (
      <section className="flex flex-col gap-4">
        <PageHeader title="Séance" backTo={backPath} backLabel="Historique" />
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

  const sourceBits = [
    session.source.programName,
    session.source.workoutTemplateName,
  ].filter(Boolean);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          to={backPath}
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          ← Historique
        </Link>

        {fromLocal ? (
          <p className="text-xs font-medium text-amber-700" role="status">
            En attente de synchronisation
          </p>
        ) : null}

        <h1 className="page-title">{session.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {formatSessionDate(session.localDate)}
          {elapsedLabel ? ` · ${elapsedLabel}` : ''}
        </p>
        {sourceBits.length > 0 ? (
          <p className="text-sm text-[var(--muted)]">{sourceBits.join(' · ')}</p>
        ) : null}
        <p
          className={cn(
            'text-[0.6875rem] font-semibold tracking-[0.12em] uppercase',
            session.status === 'CANCELLED'
              ? 'text-[var(--danger)]'
              : 'text-[var(--muted)]',
          )}
        >
          {getWorkoutStatusLabel(session.status)}
        </p>
      </header>

      <WorkoutSessionSummary
        progress={progress}
        metrics={
          session.status === 'COMPLETED' && session.metrics
            ? session.metrics
            : null
        }
        elapsedLabel={elapsedLabel}
      />

      <div>
        <h2 className="mb-1 text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
          Exercices
        </h2>
        <WorkoutSessionExerciseList
          session={session}
          effortTrackingMode="NONE"
          canRecordSets={false}
          highlightedSetId={null}
          onVersionConflict={() => undefined}
        />
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between text-left text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((value) => !value)}
        >
          Détails
          <span className="text-[var(--muted)]" aria-hidden="true">
            {detailsOpen ? '−' : '+'}
          </span>
        </button>
        {detailsOpen ? (
          <dl className="mt-2 flex flex-col gap-1.5 text-sm text-[var(--muted)]">
            <div>
              <dt className="inline">Démarrée : </dt>
              <dd className="inline">
                {formatDateTime(session.startedAt, session.timezone)}
              </dd>
            </div>
            {session.completedAt ? (
              <div>
                <dt className="inline">Terminée : </dt>
                <dd className="inline">
                  {formatDateTime(session.completedAt, session.timezone)}
                </dd>
              </div>
            ) : null}
            {session.cancelledAt ? (
              <div>
                <dt className="inline">Annulée : </dt>
                <dd className="inline">
                  {formatDateTime(session.cancelledAt, session.timezone)}
                </dd>
              </div>
            ) : null}
            {elapsedLabel ? (
              <div>
                <dt className="inline">Durée écoulée : </dt>
                <dd className="inline">{elapsedLabel}</dd>
              </div>
            ) : null}
            {session.cancellationReason ? (
              <div>
                <dt className="inline">Motif : </dt>
                <dd className="inline">{session.cancellationReason}</dd>
              </div>
            ) : null}
            {session.notes ? (
              <div>
                <dt className="inline">Notes : </dt>
                <dd className="inline">{session.notes}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={backPath} variant="secondary">
          Retour à l’historique
        </ButtonLink>
        <ButtonLink to="/planning" variant="secondary">
          Planning
        </ButtonLink>
      </div>
    </section>
  );
}
