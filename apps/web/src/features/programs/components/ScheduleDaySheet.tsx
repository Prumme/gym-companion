import type { ProgramSchedule, Weekday } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { programDetailQueryOptions } from '../api/program-query-options';
import { useReplaceProgramScheduleMutation } from '../hooks/use-program-mutations';
import {
  draftEntriesToReplaceInput,
  entriesForWeekday,
  scheduleToDraftEntries,
  setDraftDaySingleTemplate,
} from '../lib/schedule-utils';
import { getWeekdayLabel } from '../lib/weekdays';

type ScheduleDaySheetProps = {
  open: boolean;
  weekday: Weekday | null;
  programId: string;
  schedule: ProgramSchedule;
  onClose: () => void;
  onSaved?: () => void;
};

export function ScheduleDaySheet({
  open,
  weekday,
  programId,
  schedule,
  onClose,
  onSaved,
}: ScheduleDaySheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const replaceMutation = useReplaceProgramScheduleMutation();
  const detailQuery = useQuery({
    ...programDetailQueryOptions(programId),
    enabled: open && Boolean(programId),
  });

  const dayEntries = useMemo(() => {
    if (!weekday) return [];
    return entriesForWeekday(scheduleToDraftEntries(schedule), weekday);
  }, [schedule, weekday]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !weekday) return;
    const entries = entriesForWeekday(
      scheduleToDraftEntries(schedule),
      weekday,
    );
    setSelectedTemplateId(entries[0]?.workoutTemplateId ?? '');
    setError(null);
  }, [open, weekday, schedule]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !weekday) {
    return null;
  }

  const day = weekday;
  const templates = detailQuery.data?.workoutTemplates ?? [];
  const multiSessions = dayEntries.length > 1;
  const dayLabel = getWeekdayLabel(day);

  async function handleSave() {
    setError(null);
    const template =
      selectedTemplateId === ''
        ? null
        : (templates.find((item) => item.id === selectedTemplateId) ?? null);

    if (selectedTemplateId && !template) {
      setError('Séance introuvable dans ce programme.');
      return;
    }

    const nextDraft = setDraftDaySingleTemplate(
      scheduleToDraftEntries(schedule),
      day,
      template,
    );

    try {
      await replaceMutation.mutateAsync({
        programId,
        input: { entries: draftEntriesToReplaceInput(nextDraft) },
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible d’enregistrer le planning.'),
      );
    }
  }

  async function handleRemove() {
    setSelectedTemplateId('');
    setError(null);
    const nextDraft = setDraftDaySingleTemplate(
      scheduleToDraftEntries(schedule),
      day,
      null,
    );
    try {
      await replaceMutation.mutateAsync({
        programId,
        input: { entries: draftEntriesToReplaceInput(nextDraft) },
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Impossible de retirer la séance.'),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] px-[var(--space-4)] pt-[var(--space-4)] shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:left-auto md:w-full md:max-w-md md:rounded-[var(--radius-surface)]"
        style={{
          paddingBottom:
            'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="mb-[var(--space-4)] flex items-center justify-between gap-3">
          <h2 id={titleId} className="section-title">
            {dayLabel}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label="Fermer"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {detailQuery.isLoading ? (
          <p className="text-sm text-[var(--muted)]">Chargement des séances…</p>
        ) : null}

        {detailQuery.isError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {getApiErrorMessage(
              detailQuery.error,
              'Impossible de charger les séances du programme.',
            )}
          </p>
        ) : null}

        {templates.length === 0 && detailQuery.isSuccess ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--muted)]">
              Aucune séance dans ce programme.
            </p>
            <Link
              to={`/programs/${programId}`}
              className="text-sm font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Configurer les séances
            </Link>
          </div>
        ) : null}

        {templates.length > 0 ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-[var(--foreground)]">
                Séance prévue
              </span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--foreground)]"
                aria-label="Séance prévue"
              >
                <option value="">Aucune (repos)</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            {multiSessions ? (
              <p className="text-sm text-[var(--muted)]">
                Plusieurs séances sont planifiées ce jour. L’enregistrement ici
                n’en conserve qu’une.{' '}
                <Link
                  to={`/programs/${programId}/schedule`}
                  className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
                  onClick={onClose}
                >
                  Édition avancée
                </Link>
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={replaceMutation.isPending || detailQuery.isLoading}
                onClick={() => void handleSave()}
              >
                Enregistrer
              </Button>
              {dayEntries.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={replaceMutation.isPending}
                  onClick={() => void handleRemove()}
                >
                  Retirer la séance
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
