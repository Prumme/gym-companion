import { Filter } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type {
  WorkoutHistoryStatusFilterValue,
  WorkoutHistoryUrlFilters,
} from '../lib/workout-history-filters';

type WorkoutHistoryFiltersFormProps = {
  value: WorkoutHistoryUrlFilters;
  onChange: (next: WorkoutHistoryUrlFilters) => void;
  showActions?: boolean;
  onApply?: () => void;
  onReset?: () => void;
};

const statusOptions: Array<{
  value: WorkoutHistoryStatusFilterValue;
  label: string;
}> = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export function WorkoutHistoryFiltersForm({
  value,
  onChange,
  showActions = false,
  onApply,
  onReset,
}: WorkoutHistoryFiltersFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Statut</span>
          <select
            value={value.status}
            onChange={(event) =>
              onChange({
                ...value,
                status: event.target.value as WorkoutHistoryStatusFilterValue,
              })
            }
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3"
            aria-label="Filtrer par statut"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3"
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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3"
            aria-label="Date de fin"
          />
        </label>
      </div>

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:w-auto" onClick={onApply}>
            Appliquer
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onReset}
          >
            Réinitialiser
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type WorkoutHistoryFiltersBarProps = {
  filters: WorkoutHistoryUrlFilters;
  draft: WorkoutHistoryUrlFilters;
  onDraftChange: (next: WorkoutHistoryUrlFilters) => void;
  onApplyDesktop: (next: WorkoutHistoryUrlFilters) => void;
  onApplyMobile: () => void;
  onReset: () => void;
  activeFilterCount: number;
};

export function WorkoutHistoryFiltersBar({
  filters,
  draft,
  onDraftChange,
  onApplyDesktop,
  onApplyMobile,
  onReset,
  activeFilterCount,
}: WorkoutHistoryFiltersBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 md:hidden">
        <Button
          type="button"
          variant="secondary"
          className="flex-1 gap-2"
          onClick={() => {
            onDraftChange(filters);
            setFiltersOpen(true);
          }}
          aria-expanded={filtersOpen}
          aria-controls="workout-history-filters-panel"
        >
          <Filter className="size-4" aria-hidden="true" />
          Filtres
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      <div className="hidden md:block">
        <WorkoutHistoryFiltersForm
          value={filters}
          onChange={onApplyDesktop}
        />
      </div>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          role="presentation"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            id="workout-history-filters-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Filtres de l’historique"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--card)] p-4 pb-8 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filtres</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFiltersOpen(false)}
                aria-label="Fermer les filtres"
              >
                Fermer
              </Button>
            </div>
            <WorkoutHistoryFiltersForm
              value={draft}
              onChange={onDraftChange}
              showActions
              onApply={() => {
                onApplyMobile();
                setFiltersOpen(false);
              }}
              onReset={() => {
                onReset();
                setFiltersOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
