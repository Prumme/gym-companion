import { useInfiniteQuery } from '@tanstack/react-query';
import type { ProgramListItem } from '@gym-companion/shared';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { programListInfiniteQueryOptions } from '../api/program-query-options';
import { ProgramCard } from '../components/ProgramCard';
import { parseIncludeArchivedParam } from '../lib/program-form';

function dedupePrograms(items: ProgramListItem[]): ProgramListItem[] {
  const seen = new Set<string>();
  const result: ProgramListItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function ProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const includeArchived = parseIncludeArchivedParam(
    searchParams.get('includeArchived'),
  );

  const listQuery = useInfiniteQuery(
    programListInfiniteQueryOptions({ includeArchived }),
  );

  const programs = useMemo(
    () => dedupePrograms(listQuery.data?.pages.flatMap((page) => page.data) ?? []),
    [listQuery.data],
  );

  function setIncludeArchived(next: boolean) {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set('includeArchived', 'true');
    } else {
      params.delete('includeArchived');
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programmes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Crée et organise tes programmes d’entraînement.
          </p>
        </div>
        <ButtonLink
          to="/programs/new"
          className="w-full gap-2 sm:w-auto"
          aria-label="Créer un programme"
        >
          <Plus className="size-4" aria-hidden="true" />
          Créer un programme
        </ButtonLink>
      </header>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
          className="size-4 rounded border-[var(--border)]"
        />
        Inclure les programmes archivés
      </label>

      {listQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Chargement des programmes…</p>
      ) : null}

      {listQuery.isError ? (
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              listQuery.error,
              'Impossible de charger tes programmes.',
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

      {!listQuery.isLoading && !listQuery.isError && programs.length === 0 ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-6 text-center"
          role="status"
        >
          <p className="text-sm text-[var(--muted)]">
            Tu n’as encore créé aucun programme.
          </p>
          <ButtonLink to="/programs/new" className="mt-4 inline-flex">
            Créer mon premier programme
          </ButtonLink>
          {!includeArchived ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Des programmes archivés existent peut-être.{' '}
              <button
                type="button"
                className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                onClick={() => setIncludeArchived(true)}
              >
                Inclure les archivés
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {programs.map((program) => (
          <li key={program.id}>
            <ProgramCard program={program} />
          </li>
        ))}
      </ul>

      {listQuery.isFetchingNextPage ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : null}

      {listQuery.isFetchNextPageError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--danger)]">
            {getApiErrorMessage(
              listQuery.error,
              'Impossible de charger la page suivante.',
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void listQuery.fetchNextPage()}
          >
            Réessayer
          </Button>
        </div>
      ) : null}

      {listQuery.hasNextPage && !listQuery.isFetchNextPageError ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={listQuery.isFetchingNextPage}
          onClick={() => void listQuery.fetchNextPage()}
        >
          Charger plus
        </Button>
      ) : null}
    </main>
  );
}
