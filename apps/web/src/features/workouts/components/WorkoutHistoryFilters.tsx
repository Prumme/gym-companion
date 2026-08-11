import { Filter, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type {
  WorkoutHistoryStatusFilterValue,
  WorkoutHistoryUrlFilters,
} from '../lib/workout-history-filters';

const STATUS_CHIPS: Array<{
  value: WorkoutHistoryStatusFilterValue;
  label: string;
}> = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

type PeriodFiltersFormProps = {
  value: WorkoutHistoryUrlFilters;
  onChange: (next: WorkoutHistoryUrlFilters) => void;
};

function PeriodFiltersForm({ value, onChange }: PeriodFiltersFormProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Du</span>
        <input
          type="date"
          value={value.from ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              from: event.target.value || undefined,
            })
          }
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
          aria-label="Date de début"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Au</span>
        <input
          type="date"
          value={value.to ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              to: event.target.value || undefined,
            })
          }
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
          aria-label="Date de fin"
        />
      </label>
    </div>
  );
}

type WorkoutHistoryFiltersBarProps = {
  filters: WorkoutHistoryUrlFilters;
  draft: WorkoutHistoryUrlFilters;
  onDraftChange: (next: WorkoutHistoryUrlFilters) => void;
  onStatusChange: (status: WorkoutHistoryStatusFilterValue) => void;
  onApplyPeriod: (next: WorkoutHistoryUrlFilters) => void;
  onResetPeriod: () => void;
  periodFilterCount: number;
};

export function WorkoutHistoryFiltersBar({
  filters,
  draft,
  onDraftChange,
  onStatusChange,
  onApplyPeriod,
  onResetPeriod,
  periodFilterCount,
}: WorkoutHistoryFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFiltersOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [filtersOpen]);

  return (
    <>
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Statut"
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_CHIPS.map((chip) => {
            const selected = filters.status === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onStatusChange(chip.value)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                  selected
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]',
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--foreground)] hover:bg-[var(--surface)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label="Filtres de période"
          aria-expanded={filtersOpen}
          aria-controls="workout-history-filters-panel"
          onClick={() => {
            onDraftChange(filters);
            setFiltersOpen(true);
          }}
        >
          <Filter className="size-5" aria-hidden="true" />
          {periodFilterCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--primary)] text-[0.625rem] font-semibold text-[var(--primary-foreground)]">
              {periodFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-40" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--foreground)]/40"
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            id="workout-history-filters-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4 pb-8 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-auto sm:w-full sm:max-w-md sm:rounded-[var(--radius-surface)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id={titleId} className="section-title">
                Période
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)]"
                aria-label="Fermer"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <PeriodFiltersForm value={draft} onChange={onDraftChange} />
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => {
                  onApplyPeriod(draft);
                  setFiltersOpen(false);
                }}
              >
                Appliquer
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onResetPeriod();
                  setFiltersOpen(false);
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
