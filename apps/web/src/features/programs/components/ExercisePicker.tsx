import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ExerciseListItem } from '@gym-companion/shared';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  equipmentTypesQueryOptions,
  exerciseListInfiniteQueryOptions,
  muscleGroupsQueryOptions,
  type ExerciseListFilters,
} from '@/features/exercises/api/exercise-query-options';
import { ExerciseFilters } from '@/features/exercises/components/ExerciseFilters';
import { useDebouncedValue } from '@/features/exercises/hooks/use-debounced-value';
import { getMeasurementTypeLabel } from '@/features/exercises/lib/exercise-labels';
import { EMPTY_EXERCISE_LIST_FILTERS } from '@/features/exercises/lib/exercise-list-url';

type ExercisePickerProps = {
  open: boolean;
  existingExerciseIds: Set<string>;
  onSelect: (exercise: ExerciseListItem) => void;
  onClose: () => void;
};

function dedupeExercises(items: ExerciseListItem[]): ExerciseListItem[] {
  const seen = new Set<string>();
  const result: ExerciseListItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function ExercisePicker({
  open,
  existingExerciseIds,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const titleId = useId();
  const [filters, setFilters] = useState<ExerciseListFilters>({
    ...EMPTY_EXERCISE_LIST_FILTERS,
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFilters({ ...EMPTY_EXERCISE_LIST_FILTERS });
    setSearchInput('');
    setFiltersOpen(false);
  }, [open]);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch.trim() || undefined,
      includeArchived: false,
    }),
    [filters, debouncedSearch],
  );

  const muscleGroupsQuery = useQuery({
    ...muscleGroupsQueryOptions(),
    enabled: open,
  });
  const equipmentTypesQuery = useQuery({
    ...equipmentTypesQueryOptions(),
    enabled: open,
  });
  const listQuery = useInfiniteQuery({
    ...exerciseListInfiniteQueryOptions(effectiveFilters),
    enabled: open,
  });

  const exercises = useMemo(
    () => dedupeExercises(listQuery.data?.pages.flatMap((page) => page.data) ?? []),
    [listQuery.data],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-lg sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold">
              Choisir un exercice
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Recherche et filtres du catalogue.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Fermer">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-3 border-b border-[var(--border)] p-4">
          <label className="relative block" htmlFor="picker-search">
            <span className="sr-only">Rechercher un exercice</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input
              id="picker-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Rechercher un exercice"
              className="min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white py-2 pr-3 pl-10 outline-none focus:border-[var(--primary)]"
              autoComplete="off"
            />
          </label>

          <div className="md:hidden">
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              <Filter className="size-4" aria-hidden="true" />
              Filtres
            </Button>
          </div>

          <div className={filtersOpen ? 'block' : 'hidden md:block'}>
            <ExerciseFilters
              value={filters}
              onChange={setFilters}
              muscleGroups={muscleGroupsQuery.data ?? []}
              equipmentTypes={equipmentTypesQuery.data ?? []}
              referencesLoading={
                muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading
              }
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {listQuery.isLoading ? (
            <p className="text-sm text-[var(--muted)]">Chargement…</p>
          ) : null}

          {listQuery.isError ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-[var(--danger)]">
                {getApiErrorMessage(
                  listQuery.error,
                  'Impossible de charger le catalogue.',
                )}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void listQuery.refetch()}
              >
                Réessayer
              </Button>
            </div>
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && exercises.length === 0 ? (
            <p className="text-sm text-[var(--muted)]" role="status">
              Aucun exercice ne correspond à ces filtres.
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {exercises.map((exercise) => {
              const alreadyAdded = existingExerciseIds.has(exercise.id);
              const archived = exercise.archivedAt != null;
              const disabled = alreadyAdded || archived;
              return (
                <li key={exercise.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(exercise)}
                    className="flex w-full flex-col rounded-[var(--radius)] border border-[var(--border)] bg-white p-3 text-left transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="font-medium">{exercise.name}</span>
                    <span className="mt-1 text-sm text-[var(--muted)]">
                      {exercise.primaryMuscleGroup.name} ·{' '}
                      {getMeasurementTypeLabel(exercise.measurementType)}
                    </span>
                    {alreadyAdded ? (
                      <span className="mt-1 text-xs font-medium text-[var(--muted)]">
                        Déjà ajouté
                      </span>
                    ) : null}
                    {archived ? (
                      <span className="mt-1 text-xs font-medium text-amber-800">
                        Archivé
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {listQuery.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => void listQuery.fetchNextPage()}
            >
              {listQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
