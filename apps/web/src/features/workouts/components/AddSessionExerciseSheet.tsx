import type { ExerciseListItem } from '@gym-companion/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';
import { exerciseListInfiniteQueryOptions } from '@/features/exercises/api/exercise-query-options';
import { useDebouncedValue } from '@/features/exercises/hooks/use-debounced-value';

type AddSessionExerciseSheetProps = {
  open: boolean;
  presentExerciseIds: string[];
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onAdd: (exercise: ExerciseListItem) => void;
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

export function AddSessionExerciseSheet({
  open,
  presentExerciseIds,
  pending,
  errorMessage,
  onClose,
  onAdd,
}: AddSessionExerciseSheetProps) {
  const titleId = useId();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [selected, setSelected] = useState<ExerciseListItem | null>(null);
  const present = useMemo(
    () => new Set(presentExerciseIds),
    [presentExerciseIds],
  );

  useEffect(() => {
    if (!open) return;
    setSearchInput('');
    setSelected(null);
  }, [open]);

  const searchQuery = useInfiniteQuery({
    ...exerciseListInfiniteQueryOptions({
      search: debouncedSearch.trim() || undefined,
      includeArchived: false,
    }),
    enabled: open,
  });

  const searchResults = useMemo(
    () =>
      dedupeExercises(
        searchQuery.data?.pages.flatMap((page) => page.data) ?? [],
      ),
    [searchQuery.data],
  );

  const selectedAlreadyPresent =
    selected != null && present.has(selected.id);

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
              Ajouter un exercice
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Uniquement pour cette séance. Le programme reste inchangé.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Fermer">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-3 border-b border-[var(--border)] p-4">
          <label className="relative block" htmlFor="add-exercise-search">
            <span className="sr-only">Rechercher un exercice</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input
              id="add-exercise-search"
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
          {selectedAlreadyPresent ? (
            <p className="mb-3 text-sm text-[var(--danger)]" role="alert">
              Cet exercice est déjà présent dans la séance. Ajoute plutôt une
              série supplémentaire.
            </p>
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
                Aucun exercice trouvé.
              </p>
            ) : null}
            <ul className="divide-y divide-[var(--border)]">
              {searchResults.map((exercise) => {
                const alreadyPresent = present.has(exercise.id);
                return (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={selected?.id === exercise.id}
                      onClick={() => setSelected(exercise)}
                      className={`flex w-full min-h-11 items-center gap-2 py-2.5 text-left transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                        selected?.id === exercise.id ? 'bg-[var(--surface)]' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {exercise.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                          {exerciseMeta(exercise)}
                          {alreadyPresent ? ' · déjà dans la séance' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
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
            disabled={!selected || pending || selectedAlreadyPresent}
            onClick={() => {
              if (selected && !present.has(selected.id)) onAdd(selected);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {pending ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </div>
  );
}
