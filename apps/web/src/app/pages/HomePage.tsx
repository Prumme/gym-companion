import { useQuery } from '@tanstack/react-query';
import type { ActiveProgramSummary } from '@gym-companion/shared';

import { ButtonLink } from '@/components/ui/button';
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
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
        Programme courant
      </p>
      <h2 className="mt-1 text-lg font-semibold">{active.program.name}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Depuis le {formatStartedOn(active.startedOn)} · {sessionCount} séance
        {sessionCount === 1 ? '' : 's'} / semaine
      </p>
      <ButtonLink to="/planning" variant="secondary" className="mt-3 inline-flex">
        Voir le planning
      </ButtonLink>
    </section>
  );
}

export function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeQuery = useQuery({
    ...activeProgramQueryOptions(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Gym Companion</h1>
          <p className="mb-6 text-[var(--muted)]">
            Suivi d&apos;entraînement mobile-first. Les fondations Phase 0 sont en place.
          </p>
          <div className="flex flex-col gap-3">
            <ButtonLink to="/login">Se connecter</ButtonLink>
            <ButtonLink to="/register" variant="secondary">
              Créer un compte
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  const active = activeQuery.data;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Gym Companion</h1>
        <p className="text-[var(--muted)]">
          Bienvenue. Consulte ton planning ou gère tes programmes.
        </p>
      </section>

      {activeQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Chargement du programme courant…</p>
      ) : null}

      {active ? (
        <ActiveProgramSummaryCard active={active} />
      ) : !activeQuery.isLoading ? (
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm text-[var(--muted)]">Aucun programme courant.</p>
          <ButtonLink to="/programs" variant="secondary" className="mt-3 inline-flex">
            Choisir un programme
          </ButtonLink>
        </section>
      ) : null}
    </main>
  );
}
