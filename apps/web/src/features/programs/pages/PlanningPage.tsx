import type { Weekday } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { activeProgramQueryOptions } from '../api/program-query-options';
import { DeactivateProgramDialog } from '../components/ProgramActivationDialog';
import { PlanningTodayCard } from '../components/PlanningTodayCard';
import { PlanningWeekList } from '../components/PlanningWeekList';
import { ScheduleDaySheet } from '../components/ScheduleDaySheet';
import { useDeactivateProgramMutation } from '../hooks/use-program-mutations';
import {
  countScheduledSessions,
  scheduleEntryToDraft,
} from '../lib/schedule-utils';
import { getTodayWeekday } from '../lib/weekdays';

export function PlanningPage() {
  const activeQuery = useQuery(activeProgramQueryOptions());
  const deactivateMutation = useDeactivateProgramMutation();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editWeekday, setEditWeekday] = useState<Weekday | null>(null);

  if (activeQuery.isLoading) {
    return <LoadingState label="Chargement du planning…" />;
  }

  if (activeQuery.isError) {
    return (
      <main className="flex flex-1 flex-col">
        <PageHeader title="Planning" description="Ta semaine d’entraînement" />
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
      <main className="flex flex-1 flex-col">
        <PageHeader title="Planning" description="Ta semaine d’entraînement" />
        {status ? (
          <p
            className="mb-[var(--space-4)] rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
            role="status"
          >
            {status}
          </p>
        ) : null}
        <EmptyState
          title="Aucun programme actif"
          description="Active un programme pour construire ton planning."
          action={{ label: 'Voir mes programmes', to: '/programs' }}
          secondaryAction={{ label: 'Créer un programme', to: '/programs/new' }}
        />
      </main>
    );
  }

  const draftEntries = active.schedule.entries.map(scheduleEntryToDraft);
  const sessionCount = countScheduledSessions(draftEntries);
  const programId = active.program.id;
  const canEditSchedule = active.program.permissions.canEditSchedule;
  const canDeactivate = active.program.permissions.canDeactivate;
  const todayWeekday = getTodayWeekday();
  const todayEntries = active.schedule.entries
    .filter((entry) => entry.weekday === todayWeekday)
    .sort((a, b) => a.position - b.position);
  const scheduleEmpty = active.schedule.entries.length === 0;

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
    <main className="flex flex-1 flex-col">
      <PageHeader title="Planning" description="Ta semaine d’entraînement" />

      {status ? (
        <p
          className="mb-[var(--space-4)] rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {status}
        </p>
      ) : null}

      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-[var(--foreground)]">
              {active.program.name}
            </p>
            <span className="shrink-0 text-[0.6875rem] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
              Actif
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {sessionCount} séance{sessionCount === 1 ? '' : 's'} / semaine
          </p>
        </div>
        <Link
          to={`/programs/${active.program.id}`}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--foreground)] underline-offset-2 hover:underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Voir →
        </Link>
      </div>

      {scheduleEmpty ? (
        <EmptyState
          title="Planning non configuré"
          description="Organise ta semaine pour savoir quelle séance effectuer chaque jour."
          action={
            canEditSchedule
              ? {
                  label: 'Configurer ma semaine',
                  to: `/programs/${programId}/schedule`,
                }
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <PlanningTodayCard weekday={todayWeekday} entries={todayEntries} />

          <PlanningWeekList
            entries={active.schedule.entries}
            todayWeekday={todayWeekday}
            canEdit={canEditSchedule}
            onSelectDay={setEditWeekday}
          />

          <div className="flex flex-wrap items-center gap-3">
            {canEditSchedule ? (
              <ButtonLink
                to={`/programs/${programId}/schedule`}
                variant="secondary"
              >
                Modifier le planning
              </ButtonLink>
            ) : null}
            {canDeactivate ? (
              <Button
                type="button"
                variant="ghost"
                className="text-[var(--muted)]"
                onClick={() => {
                  setError(null);
                  setDeactivateOpen(true);
                }}
              >
                Désactiver le programme
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {canDeactivate ? (
        <DeactivateProgramDialog
          open={deactivateOpen}
          programName={active.program.name}
          pending={deactivateMutation.isPending}
          error={error}
          onConfirm={() => void handleDeactivate()}
          onCancel={() => setDeactivateOpen(false)}
        />
      ) : null}

      {canEditSchedule ? (
        <ScheduleDaySheet
          open={editWeekday != null}
          weekday={editWeekday}
          programId={programId}
          schedule={active.schedule}
          onClose={() => setEditWeekday(null)}
        />
      ) : null}
    </main>
  );
}
