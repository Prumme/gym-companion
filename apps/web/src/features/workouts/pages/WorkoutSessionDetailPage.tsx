import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { workoutDetailQueryOptions } from '../api/workout-query-options';
import { WorkoutSessionExerciseList } from '../components/WorkoutSessionExerciseList';
import {
  countRecordedSets,
  getWorkoutStatusLabel,
} from '../lib/workout-labels';

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
  const query = useQuery(workoutDetailQueryOptions(workoutSessionId));

  const session = query.data;
  const allSets = useMemo(
    () => session?.exercises.flatMap((exercise) => exercise.sets) ?? [],
    [session],
  );
  const recordedCount = countRecordedSets(allSets);
  const pendingCount = allSets.filter((set) => set.status === 'PENDING').length;

  if (query.isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance</h1>
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
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
        <ButtonLink to="/planning" variant="secondary">
          Retour au planning
        </ButtonLink>
      </section>
    );
  }

  if (!session) {
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
        <p className="text-sm text-[var(--muted)]" role="status">
          {recordedCount} série{recordedCount === 1 ? '' : 's'} enregistrée
          {recordedCount === 1 ? '' : 's'} sur {allSets.length}
          {pendingCount > 0
            ? ` · ${pendingCount} non traitée${pendingCount === 1 ? '' : 's'}`
            : ''}
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink to="/planning" variant="secondary">
          Retour au planning
        </ButtonLink>
        <ButtonLink to="/workouts/active" variant="secondary">
          Séance en cours
        </ButtonLink>
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
