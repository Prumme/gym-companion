import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import { activeWorkoutQueryOptions } from '../api/workout-query-options';
import { WorkoutSessionExerciseList } from '../components/WorkoutSessionExerciseList';
import {
  countRecordedSets,
  getWorkoutStatusLabel,
} from '../lib/workout-labels';

function formatStartedAt(value: string, timeZone: string): string {
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

export function ActiveWorkoutPage() {
  const query = useQuery(activeWorkoutQueryOptions());
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const session = query.data;
  const allSets = useMemo(
    () => session?.exercises.flatMap((exercise) => exercise.sets) ?? [],
    [session],
  );
  const recordedCount = countRecordedSets(allSets);
  const nextPending = allSets.find((set) => set.status === 'PENDING') ?? null;

  if (query.isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--danger)]" role="alert">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger la séance en cours.',
          )}
        </p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--muted)]">Aucune séance en cours.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink to="/planning" variant="secondary">
            Consulter le planning
          </ButtonLink>
          <ButtonLink to="/programs" variant="secondary">
            Consulter les programmes
          </ButtonLink>
        </div>
      </section>
    );
  }

  const effortTrackingMode =
    meQuery.data?.data.profile.effortTrackingMode ?? 'NONE';

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-[var(--muted)]">
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
              {formatStartedAt(session.startedAt, session.timezone)}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-[var(--muted)]" role="status">
          {recordedCount} série{recordedCount === 1 ? '' : 's'} enregistrée
          {recordedCount === 1 ? '' : 's'} sur {allSets.length}
        </p>
      </header>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Exercices</h2>
        <WorkoutSessionExerciseList
          session={session}
          effortTrackingMode={effortTrackingMode}
          canRecordSets={session.permissions.canRecordSets}
          highlightedSetId={nextPending?.id ?? null}
          onVersionConflict={() => {
            void query.refetch();
          }}
        />
      </div>
    </section>
  );
}
