import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WEEKDAY_LABELS, WEEKDAY_VALUES } from '../lib/weekdays';

import { Button, ButtonLink } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  programDetailQueryOptions,
  programScheduleQueryOptions,
} from '../api/program-query-options';
import { ReorderControls } from '../components/ReorderControls';
import { useReplaceProgramScheduleMutation } from '../hooks/use-program-mutations';
import {
  addDraftEntry,
  changeDraftEntryWeekday,
  draftEntriesEqual,
  draftEntriesToReplaceInput,
  entriesForWeekday,
  moveDraftEntryWithinDay,
  removeDraftEntry,
  scheduleToDraftEntries,
  type DraftScheduleEntry,
} from '../lib/schedule-utils';

export function ProgramScheduleEditPage() {
  const { programId = '' } = useParams();
  const detailQuery = useQuery({
    ...programDetailQueryOptions(programId),
    enabled: Boolean(programId),
  });
  const scheduleQuery = useQuery({
    ...programScheduleQueryOptions(programId),
    enabled: Boolean(programId),
  });
  const replaceMutation = useReplaceProgramScheduleMutation();

  const confirmedEntries = useMemo(
    () =>
      scheduleQuery.data
        ? scheduleToDraftEntries(scheduleQuery.data)
        : [],
    [scheduleQuery.data],
  );

  const [draftEntries, setDraftEntries] = useState<DraftScheduleEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleQuery.data) {
      setDraftEntries(scheduleToDraftEntries(scheduleQuery.data));
    }
  }, [scheduleQuery.data]);

  const isLoading = detailQuery.isLoading || scheduleQuery.isLoading;
  const isError = detailQuery.isError || scheduleQuery.isError;

  if (isLoading) {
    return <LoadingState label="Chargement du planning…" />;
  }

  if (isError || !detailQuery.data || !scheduleQuery.data) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/planning" variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour au planning
        </ButtonLink>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              detailQuery.error ?? scheduleQuery.error,
              'Impossible de charger ce planning.',
            )}
          </p>
        </div>
      </main>
    );
  }

  const program = detailQuery.data;
  const isArchived =
    program.status === 'ARCHIVED' || program.archivedAt != null;
  const readOnly = isArchived || !program.permissions.canEditSchedule;
  const isDirty = !draftEntriesEqual(draftEntries, confirmedEntries);
  const templates = program.workoutTemplates;

  function handleCancel() {
    setDraftEntries(confirmedEntries);
    setError(null);
    setStatus(null);
  }

  async function handleSave() {
    setError(null);
    try {
      await replaceMutation.mutateAsync({
        programId: program.id,
        input: { entries: draftEntriesToReplaceInput(draftEntries) },
      });
      setStatus('Planning enregistré.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’enregistrer le planning.'));
    }
  }

  function renderAddTemplate(weekday: (typeof WEEKDAY_VALUES)[number]) {
    if (readOnly || templates.length === 0) {
      return null;
    }

    return (
      <label className="mt-2 block text-sm">
        <span className="sr-only">
          Ajouter une séance le {WEEKDAY_LABELS[weekday]}
        </span>
        <select
          className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          defaultValue=""
          onChange={(event) => {
            const templateId = event.target.value;
            if (!templateId) {
              return;
            }
            const template = templates.find((item) => item.id === templateId);
            if (!template) {
              return;
            }
            setDraftEntries((current) =>
              addDraftEntry(current, weekday, template),
            );
            event.target.value = '';
          }}
        >
          <option value="">Ajouter une séance…</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <ButtonLink
          to={program.isCurrent ? '/planning' : `/programs/${program.id}`}
          variant="ghost"
          className="mb-3 w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {program.isCurrent ? 'Retour au planning' : 'Retour au programme'}
        </ButtonLink>

        <h1 className="text-2xl font-bold tracking-tight">
          Planning hebdomadaire
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{program.name}</p>
        {readOnly ? (
          <p className="mt-2 text-sm text-amber-900">
            {isArchived
              ? 'Ce programme est archivé : le planning est en lecture seule.'
              : 'Tu n’as pas la permission de modifier ce planning.'}
          </p>
        ) : null}
      </div>

      {status ? (
        <p
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {status}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
          role="status"
        >
          <p className="text-sm text-[var(--muted)]">
            Ce programme n’a aucun modèle de séance. Configure-les d’abord pour
            planifier ta semaine.
          </p>
          <ButtonLink
            to={`/programs/${program.id}`}
            variant="secondary"
            className="mt-3 inline-flex"
          >
            Configurer les séances
          </ButtonLink>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {WEEKDAY_VALUES.map((weekday) => {
            const dayEntries = entriesForWeekday(draftEntries, weekday);
            return (
              <section
                key={weekday}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <h2 className="text-sm font-semibold">
                  {WEEKDAY_LABELS[weekday]}
                </h2>

                {dayEntries.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">Repos</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {dayEntries.map((entry, index) => (
                      <li
                        key={entry.clientId}
                        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {entry.workoutTemplate.name}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {entry.workoutTemplate.exerciseCount} exercice
                              {entry.workoutTemplate.exerciseCount === 1
                                ? ''
                                : 's'}
                            </p>
                          </div>
                          {!readOnly ? (
                            <div className="flex flex-col gap-2 sm:items-end">
                              <label className="text-xs text-[var(--muted)]">
                                Jour
                                <select
                                  className="mt-1 block w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm sm:w-40"
                                  value={entry.weekday}
                                  onChange={(event) =>
                                    setDraftEntries((current) =>
                                      changeDraftEntryWeekday(
                                        current,
                                        entry.clientId,
                                        event.target.value as typeof weekday,
                                      ),
                                    )
                                  }
                                >
                                  {WEEKDAY_VALUES.map((day) => (
                                    <option key={day} value={day}>
                                      {WEEKDAY_LABELS[day]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <ReorderControls
                                label={entry.workoutTemplate.name}
                                canMoveUp={index > 0}
                                canMoveDown={index < dayEntries.length - 1}
                                onMoveUp={() =>
                                  setDraftEntries((current) =>
                                    moveDraftEntryWithinDay(
                                      current,
                                      entry.clientId,
                                      'up',
                                    ),
                                  )
                                }
                                onMoveDown={() =>
                                  setDraftEntries((current) =>
                                    moveDraftEntryWithinDay(
                                      current,
                                      entry.clientId,
                                      'down',
                                    ),
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full sm:w-auto"
                                onClick={() =>
                                  setDraftEntries((current) =>
                                    removeDraftEntry(current, entry.clientId),
                                  )
                                }
                              >
                                Retirer
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {renderAddTemplate(weekday)}
              </section>
            );
          })}
        </div>
      )}

      {!readOnly && templates.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            disabled={!isDirty || replaceMutation.isPending}
            onClick={() => void handleSave()}
          >
            {replaceMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!isDirty || replaceMutation.isPending}
            onClick={handleCancel}
          >
            Annuler
          </Button>
        </div>
      ) : null}
    </main>
  );
}
