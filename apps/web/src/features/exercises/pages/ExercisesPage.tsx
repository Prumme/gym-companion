import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ExerciseListItem } from '@gym-companion/shared';
import { Filter, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  equipmentTypesQueryOptions,
  exerciseListInfiniteQueryOptions,
  muscleGroupsQueryOptions,
  type ExerciseListFilters,
} from '../api/exercise-query-options';
import { ExerciseFilters } from '../components/ExerciseFilters';
import { ExerciseList } from '../components/ExerciseList';
import { ExerciseListSkeleton } from '../components/ExerciseListSkeleton';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import {
  countActiveExerciseFilters,
  EMPTY_EXERCISE_LIST_FILTERS,
  parseExerciseListSearchParams,
  serializeExerciseListSearchParams,
} from '../lib/exercise-list-url';

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

export function ExercisesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseExerciseListSearchParams(searchParams),
    [searchParams],
  );

  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ExerciseListFilters>(filters);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    if ((filters.search ?? undefined) === nextSearch) {
      return;
    }
    const next = serializeExerciseListSearchParams({
      ...filters,
      search: nextSearch,
    });
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, filters, setSearchParams]);

  useEffect(() => {
    if (filtersOpen) {
      setDraftFilters(filters);
    }
  }, [filtersOpen, filters]);

  const muscleGroupsQuery = useQuery(muscleGroupsQueryOptions());
  const equipmentTypesQuery = useQuery(equipmentTypesQueryOptions());

  const listQuery = useInfiniteQuery(exerciseListInfiniteQueryOptions(filters));

  const exercises = useMemo(
    () => dedupeExercises(listQuery.data?.pages.flatMap((page) => page.data) ?? []),
    [listQuery.data],
  );

  const activeFilterCount = countActiveExerciseFilters({
    ...filters,
    search: undefined,
  });
  const hasAnyFilter = countActiveExerciseFilters(filters) > 0;
  const showCreateInEmptyState =
    !hasAnyFilter || filters.source === 'USER';
  const isInitialLoading = listQuery.isLoading;

  function applyFiltersToUrl(next: ExerciseListFilters) {
    setSearchParams(serializeExerciseListSearchParams(next), { replace: true });
  }

  function resetFilters() {
    setSearchInput('');
    applyFiltersToUrl(EMPTY_EXERCISE_LIST_FILTERS);
    setFiltersOpen(false);
  }

  function applyDesktopFilters(next: ExerciseListFilters) {
    applyFiltersToUrl({
      ...next,
      search: searchInput.trim() || undefined,
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exercices</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Catalogue système et exercices personnels.
          </p>
        </div>
        <ButtonLink
          to="/exercises/new"
          className="w-full gap-2 sm:w-auto"
          aria-label="Créer un exercice"
        >
          <Plus className="size-4" aria-hidden="true" />
          Créer un exercice
        </ButtonLink>
      </header>

      <div className="flex flex-col gap-3">
        <label className="relative block" htmlFor="exercise-search">
          <span className="sr-only">Rechercher un exercice</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          />
          <input
            id="exercise-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Rechercher un exercice"
            className="min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white py-2 pr-10 pl-10 outline-none focus:border-[var(--primary)]"
            autoComplete="off"
          />
          {searchInput ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-slate-100"
              onClick={() => setSearchInput('')}
              aria-label="Effacer la recherche"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 gap-2"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-controls="exercise-filters-panel"
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
      </div>

      <div className="hidden md:block">
        <ExerciseFilters
          value={{ ...filters, search: undefined }}
          onChange={applyDesktopFilters}
          muscleGroups={muscleGroupsQuery.data ?? []}
          equipmentTypes={equipmentTypesQuery.data ?? []}
          referencesLoading={
            muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading
          }
        />
      </div>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          role="presentation"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            id="exercise-filters-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Filtres des exercices"
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
            <ExerciseFilters
              value={draftFilters}
              onChange={setDraftFilters}
              muscleGroups={muscleGroupsQuery.data ?? []}
              equipmentTypes={equipmentTypesQuery.data ?? []}
              referencesLoading={
                muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading
              }
              showActions
              onApply={() => {
                applyFiltersToUrl({
                  ...draftFilters,
                  search: searchInput.trim() || undefined,
                });
                setFiltersOpen(false);
              }}
              onReset={resetFilters}
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p aria-live="polite">
          {isInitialLoading
            ? 'Chargement…'
            : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''} chargé${exercises.length > 1 ? 's' : ''}`}
        </p>
        {hasAnyFilter ? (
          <button
            type="button"
            className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={resetFilters}
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3" role="alert">
          <p className="text-sm text-[var(--danger)]">{feedback}</p>
        </div>
      ) : null}

      {listQuery.isError && !listQuery.data ? (
        <div className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              listQuery.error,
              'Impossible de charger les exercices.',
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void listQuery.refetch()}
          >
            Réessayer
          </Button>
        </div>
      ) : null}

      {isInitialLoading ? <ExerciseListSkeleton /> : null}

      {!isInitialLoading && exercises.length === 0 && !listQuery.isError ? (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            {hasAnyFilter
              ? filters.source === 'USER' &&
                countActiveExerciseFilters({ ...filters, source: undefined }) === 0
                ? 'Aucun exercice personnel pour le moment.'
                : 'Aucun exercice ne correspond à tes filtres.'
              : 'Aucun exercice disponible.'}
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {hasAnyFilter ? (
              <Button
                type="button"
                variant="secondary"
                onClick={resetFilters}
              >
                Réinitialiser les filtres
              </Button>
            ) : null}
            {showCreateInEmptyState ? (
              <ButtonLink to="/exercises/new" className="gap-2">
                <Plus className="size-4" aria-hidden="true" />
                Créer un exercice
              </ButtonLink>
            ) : null}
          </div>
        </div>
      ) : null}

      {exercises.length > 0 ? (
        <>
          <ExerciseList exercises={exercises} onFeedback={setFeedback} />

          {listQuery.isFetchNextPageError ? (
            <div
              className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3"
              role="alert"
            >
              <p className="text-sm text-[var(--danger)]">
                {getApiErrorMessage(
                  listQuery.error,
                  'Impossible de charger la suite.',
                )}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={() => void listQuery.fetchNextPage()}
              >
                Réessayer
              </Button>
            </div>
          ) : null}

          {listQuery.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => void listQuery.fetchNextPage()}
              aria-busy={listQuery.isFetchingNextPage}
            >
              {listQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
            </Button>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
