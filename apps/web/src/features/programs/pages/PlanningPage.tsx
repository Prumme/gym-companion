import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage } from '@/lib/api/client';

import { activeProgramQueryOptions } from '../api/program-query-options';
import { useDeactivateProgramMutation } from '../hooks/use-program-mutations';
import { DeactivateProgramDialog } from '../components/ProgramActivationDialog';
import { WeeklyScheduleDisplay } from '../components/WeeklyScheduleDisplay';
import { formatStartedOn } from '../lib/format';
import { countScheduledSessions } from '../lib/schedule-utils';

export function PlanningPage() {
  const activeQuery = useQuery(activeProgramQueryOptions());
  const deactivateMutation = useDeactivateProgramMutation();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (activeQuery.isLoading) {
    return <LoadingState label="Chargement du planning…" />;
  }

  if (activeQuery.isError) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              activeQuery.error,
              'Impossible de charger ton planning.',
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void activeQuery.refetch()}
          >
            Réessayer
          </Button>
        </div>
      </main>
    );
  }

  const active = activeQuery.data;

  if (!active) {
    return (
      <main className="flex flex-1 flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ta semaine d’entraînement basée sur ton programme courant.
          </p>
        </header>

        {status ? (
          <p
            className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            role="status"
          >
            {status}
          </p>
        ) : null}

        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center"
          role="status"
        >
          <CalendarDays
            className="mx-auto mb-3 size-10 text-[var(--muted)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--muted)]">Aucun programme courant.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink to="/programs" variant="secondary">
              Voir mes programmes
            </ButtonLink>
            <ButtonLink to="/programs/new">Créer un programme</ButtonLink>
          </div>
        </div>
      </main>
    );
  }

  const sessionCount = countScheduledSessions(
    active.schedule.entries.map((entry) => ({
      clientId: entry.id,
      workoutTemplateId: entry.workoutTemplate.id,
      weekday: entry.weekday,
      position: entry.position,
      workoutTemplate: entry.workoutTemplate,
    })),
  );
  const programId = active.program.id;
  const canEditSchedule = active.program.permissions.canEditSchedule;
  const canDeactivate = active.program.permissions.canDeactivate;

  async function handleDeactivate() {
    setError(null);
    try {
      await deactivateMutation.mutateAsync(programId);
      setDeactivateOpen(false);
      setStatus('Programme courant désactivé.');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de désactiver ce programme.'),
      );
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Programme courant et semaine type.
        </p>
      </header>

      {status ? (
        <p
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {status}
        </p>
      ) : null}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Programme courant
            </p>
            <h2 className="mt-1 text-xl font-semibold">{active.program.name}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Depuis le {formatStartedOn(active.startedOn)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {sessionCount} séance{sessionCount === 1 ? '' : 's'} planifiée
              {sessionCount === 1 ? '' : 's'} par semaine
            </p>
          </div>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900">
            Actif
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ButtonLink
            to={`/programs/${active.program.id}`}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Voir le programme
          </ButtonLink>
          {canEditSchedule ? (
            <ButtonLink
              to={`/programs/${active.program.id}/schedule`}
              className="w-full sm:w-auto"
            >
              Modifier le planning
            </ButtonLink>
          ) : null}
          {canDeactivate ? (
            <>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => {
                  setError(null);
                  setDeactivateOpen(true);
                }}
              >
                Désactiver
              </Button>
              <DeactivateProgramDialog
                open={deactivateOpen}
                programName={active.program.name}
                pending={deactivateMutation.isPending}
                error={error}
                onConfirm={() => void handleDeactivate()}
                onCancel={() => setDeactivateOpen(false)}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
          Semaine type
        </h2>
        <WeeklyScheduleDisplay
          entries={active.schedule.entries}
          showStartActions
        />
      </section>
    </main>
  );
}
