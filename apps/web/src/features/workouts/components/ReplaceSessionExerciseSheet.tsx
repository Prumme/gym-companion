import type {
  ExerciseListItem,
  ExerciseMeasurementType,
  WorkoutSessionExerciseDetail,
} from '@gym-companion/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';
import {
  exerciseDetailQueryOptions,
  exerciseListInfiniteQueryOptions,
} from '@/features/exercises/api/exercise-query-options';
import { useDebouncedValue } from '@/features/exercises/hooks/use-debounced-value';

type ReplaceSessionExerciseSheetProps = {
  open: boolean;
  currentExercise: WorkoutSessionExerciseDetail;
  measurementType: ExerciseMeasurementType;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onReplace: (exercise: ExerciseListItem) => void;
};

function dedupeExercises(items: ExerciseListItem[]): ExerciseListItem[] {
  const seen = new Set<string>();
  const result: ExerciseListItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function exerciseMeta(exercise: ExerciseListItem): string {
  const parts = [exercise.primaryMuscleGroup.name];
  const equipment = exercise.defaultEquipmentType?.name?.trim();
  if (equipment) parts.push(equipment);
  return parts.join(' · ');
}

export function ReplaceSessionExerciseSheet({
  open,
  currentExercise,
  measurementType,
  pending,
  errorMessage,
  onClose,
  onReplace,
}: ReplaceSessionExerciseSheetProps) {
  const titleId = useId();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [selected, setSelected] = useState<ExerciseListItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearchInput('');
    setSelected(null);
  }, [open]);

  const currentCatalogId = currentExercise.sourceExerciseId;
  const currentDetailQuery = useQuery({
    ...exerciseDetailQueryOptions(currentCatalogId ?? ''),
    enabled: open && currentCatalogId != null,
  });

  const primaryMuscleGroupId =
    currentDetailQuery.data?.primaryMuscleGroup.id ?? undefined;

  const alternativesQuery = useInfiniteQuery({
    ...exerciseListInfiniteQueryOptions({
      measurementType,
      muscleGroupId: primaryMuscleGroupId,
      includeArchived: false,
    }),
    enabled: open && primaryMuscleGroupId != null,
  });

  const searchQuery = useInfiniteQuery({
    ...exerciseListInfiniteQueryOptions({
      measurementType,
      search: debouncedSearch.trim() || undefined,
      includeArchived: false,
    }),
    enabled: open,
  });

  const alternatives = useMemo(() => {
    const rows = dedupeExercises(
      alternativesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    ).filter((item) => item.id !== currentCatalogId);
    return rows.slice(0, 5);
  }, [alternativesQuery.data, currentCatalogId]);

  const searchResults = useMemo(
    () =>
      dedupeExercises(
        searchQuery.data?.pages.flatMap((page) => page.data) ?? [],
      ).filter((item) => item.id !== currentCatalogId),
    [searchQuery.data, currentCatalogId],
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
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold">
              Remplacer {currentExercise.exerciseName}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Même type de mesure uniquement. Le programme reste inchangé.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Fermer">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-3 border-b border-[var(--border)] p-4">
          <label className="relative block" htmlFor="replace-exercise-search">
            <span className="sr-only">Rechercher un exercice</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input
              id="replace-exercise-search"
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSelected(null);
              }}
              placeholder="Rechercher un exercice…"
              className="min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-white py-2 pr-3 pl-10 outline-none focus:border-[var(--primary)]"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {errorMessage ? (
            <p className="mb-3 text-sm text-[var(--danger)]" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!debouncedSearch.trim() && alternatives.length > 0 ? (
            <section className="mb-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Alternatives du même groupe musculaire
              </h4>
              <ul className="divide-y divide-[var(--border)]">
                {alternatives.map((exercise) => (
                  <ExerciseChoiceRow
                    key={`alt-${exercise.id}`}
                    exercise={exercise}
                    selected={selected?.id === exercise.id}
                    disabled={pending}
                    onSelect={setSelected}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Catalogue
            </h4>
            {searchQuery.isLoading ? (
              <p className="text-sm text-[var(--muted)]">Chargement…</p>
            ) : null}
            {searchQuery.isError ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {getApiErrorMessage(
                  searchQuery.error,
                  'Impossible de charger le catalogue.',
                )}
              </p>
            ) : null}
            {!searchQuery.isLoading &&
            !searchQuery.isError &&
            searchResults.length === 0 ? (
              <p className="text-sm text-[var(--muted)]" role="status">
                Aucun exercice compatible.
              </p>
            ) : null}
            <ul className="divide-y divide-[var(--border)]">
              {searchResults.map((exercise) => (
                <ExerciseChoiceRow
                  key={exercise.id}
                  exercise={exercise}
                  selected={selected?.id === exercise.id}
                  disabled={pending}
                  onSelect={setSelected}
                />
              ))}
            </ul>
            {searchQuery.hasNextPage ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full"
                disabled={searchQuery.isFetchingNextPage || pending}
                onClick={() => void searchQuery.fetchNextPage()}
              >
                {searchQuery.isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
              </Button>
            ) : null}
          </section>
        </div>

        <div className="border-t border-[var(--border)] p-4">
          <Button
            type="button"
            className="w-full gap-2"
            disabled={!selected || pending}
            onClick={() => {
              if (selected) onReplace(selected);
            }}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            {pending ? 'Remplacement…' : 'Remplacer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExerciseChoiceRow({
  exercise,
  selected,
  disabled,
  onSelect,
}: {
  exercise: ExerciseListItem;
  selected: boolean;
  disabled: boolean;
  onSelect: (exercise: ExerciseListItem) => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={() => onSelect(exercise)}
        className={`flex w-full min-h-11 items-center gap-2 py-2.5 text-left transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
          selected ? 'bg-[var(--surface)]' : ''
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {exercise.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
            {exerciseMeta(exercise)}
          </span>
        </span>
      </button>
    </li>
  );
}
