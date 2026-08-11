import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import { coachingOverviewQueryOptions } from '../api/coaching-query-options';
import { getExerciseCoachStatusLabel } from '../lib/coach-labels';

export function CoachOverviewPage() {
  const query = useQuery(coachingOverviewQueryOptions());
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const aiAvailable = meQuery.data?.data.ai.available === true;

  return (
    <main className="flex flex-1 flex-col gap-[var(--space-6)]">
      <PageHeader
        title="Coach"
        description="Conseils basés sur ton entraînement."
        className="mb-0"
      />

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
        <EmptyState
          title="Rien à signaler"
          description="Aucun exercice récent ne nécessite une attention particulière."
          action={{ label: 'Voir la progression', to: '/progress/overview' }}
        />
      ) : null}

      {query.isSuccess && query.data.items.length > 0 ? (
        <section aria-labelledby="coach-watch-heading">
          <h2 id="coach-watch-heading" className="section-title mb-2">
            À surveiller
          </h2>
          <p className="secondary-text mb-3">
            Analyses calculées par Gym Companion à partir de tes séances.
          </p>
          <ul className="flex flex-col">
            {query.data.items.map((item) => {
              const statusLabel =
                item.headline || getExerciseCoachStatusLabel(item.status);
              return (
                <li key={item.exerciseId}>
                  <Link
                    to={`/progress/exercises/${encodeURIComponent(item.exerciseId)}`}
                    className="flex min-h-11 items-start justify-between gap-3 border-b border-[var(--border)] py-3 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    aria-label={`${item.exerciseName} — ${statusLabel}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">
                        {item.exerciseName}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">
                        {statusLabel}
                      </span>
                      {item.latestWorkoutDate ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                          Dernière séance : {item.latestWorkoutDate}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className="mt-1 size-4 shrink-0 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section
        className="border-t border-[var(--border)] pt-[var(--space-6)]"
        aria-labelledby="coach-ask-heading"
      >
        <h2 id="coach-ask-heading" className="section-title">
          Poser une question
        </h2>
        <p className="secondary-text mt-2">
          Explications IA facultatives — distinctes des recommandations
          calculées ci-dessus.
        </p>
        {aiAvailable ? (
          <ButtonLink to="/coach/chat" variant="secondary" className="mt-4 w-fit">
            Demander au Coach IA
          </ButtonLink>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Indisponible sur cet environnement. L’analyse Coach ci-dessus reste
            disponible sans IA.
          </p>
        )}
      </section>
    </main>
  );
}
