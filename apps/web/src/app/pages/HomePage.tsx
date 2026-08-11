import { useQuery } from '@tanstack/react-query';
import type { ActiveProgramSummary } from '@gym-companion/shared';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

import { activeProgramQueryOptions } from '@/features/programs/api/program-query-options';
import { formatStartedOn } from '@/features/programs/lib/format';
import { countScheduledSessions } from '@/features/programs/lib/schedule-utils';

function ActiveProgramSummaryCard({ active }: { active: ActiveProgramSummary }) {
  const sessionCount = countScheduledSessions(
    active.schedule.entries.map((entry) => ({
      clientId: entry.id,
      workoutTemplateId: entry.workoutTemplate.id,
      weekday: entry.weekday,
      position: entry.position,
      workoutTemplate: entry.workoutTemplate,
    })),
  );

  return (
    <Card>
      <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        Programme courant
      </p>
      <h2 className="mt-1 text-lg font-semibold">{active.program.name}</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Depuis le {formatStartedOn(active.startedOn)} · {sessionCount} séance
        {sessionCount === 1 ? '' : 's'} / semaine
      </p>
      <ButtonLink to="/planning" variant="secondary" className="mt-3 inline-flex">
        Voir le planning
      </ButtonLink>
    </Card>
  );
}

export function HomePage() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const isAuthenticated = authStatus === 'authenticated';
  const activeQuery = useQuery({
    ...activeProgramQueryOptions(),
    enabled: isAuthenticated,
  });

  if (authStatus === 'initializing') {
    return <LoadingState label="Vérification de la session…" />;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex flex-1 flex-col gap-[var(--space-6)]">
        <PageHeader brand title="Gym Companion" />
        <EmptyState
          title="Suivi d’entraînement mobile-first"
          description="Connecte-toi pour consulter ton planning et tes programmes."
          action={{ label: 'Se connecter', to: '/login' }}
          secondaryAction={{ label: 'Créer un compte', to: '/register' }}
        />
      </main>
    );
  }

  const active = activeQuery.data;

  return (
    <main className="flex flex-1 flex-col gap-[var(--space-6)]">
      <PageHeader
        brand
        title="Prêt pour ta prochaine séance ?"
        actions={
          <Link
            to="/profile"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            aria-label="Profil"
          >
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
        }
      />

      {activeQuery.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Chargement du programme courant…
        </p>
      ) : null}

      {active ? (
        <ActiveProgramSummaryCard active={active} />
      ) : !activeQuery.isLoading ? (
        <EmptyState
          title="Aucun programme actif"
          description="Crée un programme ou choisis-en un existant pour démarrer."
          action={{ label: 'Créer un programme', to: '/programs/new' }}
          secondaryAction={{ label: 'Choisir un programme', to: '/programs' }}
        />
      ) : null}
    </main>
  );
}
