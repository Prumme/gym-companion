import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ExerciseListItem } from '@gym-companion/shared';
import { Filter, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  equipmentTypesQueryOptions,
  exerciseListInfiniteQueryOptions,
  muscleGroupsQueryOptions,
  type ExerciseListFilters,
} from '../api/exercise-query-options';
import { ExerciseActiveFilterChips } from '../components/ExerciseActiveFilterChips';
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

  const nonSearchFilters = useMemo(
    () => ({ ...filters, search: undefined }),
    [filters],
  );
  const activeFilterCount = countActiveExerciseFilters(nonSearchFilters);
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

  function patchFilters(patch: Partial<ExerciseListFilters>) {
    applyFiltersToUrl({
      ...filters,
      ...patch,
      search: searchInput.trim() || undefined,
    });
  }

  function applyDesktopFilters(next: ExerciseListFilters) {
    applyFiltersToUrl({
      ...next,
      search: searchInput.trim() || undefined,
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-[var(--space-4)]">
      <PageHeader
        title="Exercices"
        description="Catalogue et exercices personnels"
        className="mb-0"
        actions={
          <ButtonLink
            to="/exercises/new"
            variant="secondary"
            className="gap-1.5 px-3"
            aria-label="Créer un exercice"
          >
            <Plus className="size-4" aria-hidden="true" />
            Créer
          </ButtonLink>
        }
      />

      <div className="sticky top-0 z-10 -mx-1 bg-[var(--background)] px-1 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1" htmlFor="exercise-search">
            <span className="sr-only">Rechercher un exercice</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <input
              id="exercise-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Rechercher un exercice"
              className="min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] py-2 pr-10 pl-10 text-sm outline-none focus:border-[var(--primary)]"
              autoComplete="off"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted-foreground)] hover:bg-[var(--background)]"
                onClick={() => setSearchInput('')}
                aria-label="Effacer la recherche"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>

          <Button
            type="button"
            variant="secondary"
            className="relative shrink-0 gap-1.5 px-3 md:hidden"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-controls="exercise-filters-panel"
            aria-label={
              activeFilterCount > 0
                ? `Filtres, ${activeFilterCount} actifs`
                : 'Filtres'
            }
          >
            <Filter className="size-4" aria-hidden="true" />
            Filtres
            {activeFilterCount > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--primary)] text-[0.625rem] font-semibold text-[var(--primary-foreground)]">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="mt-3 hidden md:block">
          <ExerciseFilters
            value={nonSearchFilters}
            onChange={applyDesktopFilters}
            muscleGroups={muscleGroupsQuery.data ?? []}
            equipmentTypes={equipmentTypesQuery.data ?? []}
            referencesLoading={
              muscleGroupsQuery.isLoading || equipmentTypesQuery.isLoading
            }
          />
        </div>

        {activeFilterCount > 0 ? (
          <div className="mt-3">
            <ExerciseActiveFilterChips
              filters={nonSearchFilters}
              muscleGroups={muscleGroupsQuery.data ?? []}
              equipmentTypes={equipmentTypesQuery.data ?? []}
              onClear={patchFilters}
              onClearAll={resetFilters}
            />
          </div>
        ) : null}
      </div>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-40 bg-[var(--foreground)]/40 md:hidden"
          role="presentation"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            id="exercise-filters-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Filtres des exercices"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
            style={{
              paddingBottom:
                'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Filtres</h2>
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

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted-foreground)]">
        <p aria-live="polite">
          {isInitialLoading
            ? 'Chargement…'
            : `${exercises.length} exercice${exercises.length > 1 ? 's' : ''} chargé${exercises.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {feedback ? (
        <div
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{feedback}</p>
        </div>
      ) : null}

      {listQuery.isError && !listQuery.data ? (
        <div
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"
          role="alert"
        >
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
        <EmptyState
          title="Aucun résultat"
          description={
            hasAnyFilter
              ? filters.source === 'USER' &&
                countActiveExerciseFilters({ ...filters, source: undefined }) === 0
                ? 'Aucun exercice personnel pour le moment.'
                : 'Aucun exercice ne correspond à ces critères.'
              : 'Aucun exercice disponible.'
          }
          action={
            hasAnyFilter
              ? { label: 'Effacer les filtres', onClick: resetFilters }
              : showCreateInEmptyState
                ? { label: 'Créer un exercice', to: '/exercises/new' }
                : undefined
          }
          secondaryAction={
            hasAnyFilter && showCreateInEmptyState
              ? { label: 'Créer un exercice', to: '/exercises/new' }
              : undefined
          }
        />
      ) : null}

      {exercises.length > 0 ? (
        <>
          <ExerciseList exercises={exercises} onFeedback={setFeedback} />

          {listQuery.isFetchNextPageError ? (
            <div
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3"
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
