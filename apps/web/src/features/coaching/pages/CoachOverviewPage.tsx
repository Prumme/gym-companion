import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { coachingOverviewQueryOptions } from '../api/coaching-query-options';
import { getExerciseCoachStatusLabel } from '../lib/coach-labels';

export function CoachOverviewPage() {
  const query = useQuery(coachingOverviewQueryOptions());

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Coach</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Une synthèse basée sur tes séances, ta progression et tes
          recommandations récentes.
        </p>
      </header>

      {query.isLoading ? <LoadingState label="Chargement du Coach…" /> : null}

      {query.isError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger la vue Coach.',
          )}
        </p>
      ) : null}

      {query.isSuccess && query.data.items.length === 0 ? (
        <section
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
          aria-label="Aucune attention particulière"
        >
          <p className="text-sm font-semibold">Rien à signaler pour le moment</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aucun exercice récent ne nécessite une attention particulière.
          </p>
          <ButtonLink to="/progress" variant="secondary" className="mt-4 min-h-10">
            Voir la progression
          </ButtonLink>
        </section>
      ) : null}

      {query.isSuccess && query.data.items.length > 0 ? (
        <section className="space-y-3" aria-label="Points d’attention">
          <h2 className="text-sm font-medium text-[var(--muted)]">
            À regarder
          </h2>
          <ul className="space-y-3">
            {query.data.items.map((item) => (
              <li key={item.exerciseId}>
                <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
                  <h3 className="text-base font-semibold">{item.exerciseName}</h3>
                  <p className="mt-1 text-sm font-medium">
                    {item.headline || getExerciseCoachStatusLabel(item.status)}
                  </p>
                  {item.latestWorkoutDate ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Dernière séance : {item.latestWorkoutDate}
                    </p>
                  ) : null}
                  <Link
                    to={`/progress/exercises/${encodeURIComponent(item.exerciseId)}`}
                    className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                  >
                    Voir l’analyse
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
