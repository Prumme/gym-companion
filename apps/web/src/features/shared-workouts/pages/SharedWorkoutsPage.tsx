import { Plus, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api/client';

import { sharedWorkoutRoomsListQueryOptions } from '../api/shared-workout-query-options';
import { SharedWorkoutJoinSheet } from '../components/SharedWorkoutJoinSheet';
import { getSharedWorkoutRoomStatusLabel } from '../lib/shared-workout-labels';

const FILTERS: Array<{ value: '' | SharedWorkoutRoomStatus; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'LOBBY', label: 'En préparation' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

export function SharedWorkoutsPage() {
  const [statusFilter, setStatusFilter] = useState<'' | SharedWorkoutRoomStatus>(
    '',
  );
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      limit: 20,
    }),
    [statusFilter],
  );
  const query = useQuery(sharedWorkoutRoomsListQueryOptions(filters));
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  const sorted = useMemo(() => {
    const items = query.data?.data ?? [];
    const priority: Record<SharedWorkoutRoomStatus, number> = {
      ACTIVE: 0,
      LOBBY: 1,
      COMPLETED: 2,
      CANCELLED: 3,
    };
    return [...items].sort((a, b) => {
      const byStatus = priority[a.status] - priority[b.status];
      if (byStatus !== 0) return byStatus;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  }, [query.data?.data]);

  const isEmpty =
    !query.isLoading && !query.isError && sorted.length === 0;
  const showHeaderCreate = !isEmpty;

  return (
    <main className="flex w-full flex-1 flex-col gap-5">
      <PageHeader
        title="Séances partagées"
        description="Entraîne-toi avec tes amis."
        className="mb-0"
        actions={
          showHeaderCreate ? (
            <ButtonLink
              to="/shared-workouts/new"
              className="gap-2"
              aria-disabled={offline || undefined}
              onClick={(event) => {
                if (offline) event.preventDefault();
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Créer une salle
            </ButtonLink>
          ) : undefined
        }
      />

      {!offline ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setJoinSheetOpen(true)}
          >
            Rejoindre avec un code
          </Button>
        </div>
      ) : null}

      {offline ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          Une connexion est nécessaire pour créer ou rejoindre une salle.
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Filtrer par statut"
        className="flex gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((filter) => {
          const selected = statusFilter === filter.value;
          return (
            <button
              key={filter.value || 'all'}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
                selected
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
          {Array.from({ length: 3 }).map((_, index) => (
            <li
              key={index}
              className="h-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]/60"
            />
          ))}
        </ul>
      ) : null}

      {query.isError ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {getApiErrorMessage(query.error, 'Impossible de charger les salles.')}
        </p>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-col gap-3">
          <EmptyState
            title="Aucune séance partagée"
            description="Crée une salle pour t’entraîner avec d’autres personnes."
            action={
              offline
                ? undefined
                : { label: 'Créer une salle', to: '/shared-workouts/new' }
            }
          />
          {!offline ? (
            <Button
              type="button"
              variant="ghost"
              className="self-center"
              onClick={() => setJoinSheetOpen(true)}
            >
              Saisir un code
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isEmpty && sorted.length > 0 ? (
        <section aria-labelledby="shared-rooms-heading">
          <h2
            id="shared-rooms-heading"
            className="mb-2 text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
          >
            Mes salles
          </h2>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {sorted.map((room) => (
              <li key={room.id}>
                <Link
                  to={`/shared-workouts/${room.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 py-2.5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  aria-label={`${room.name}, ${getSharedWorkoutRoomStatusLabel(room.status)}, ${room.memberCount} participant${room.memberCount > 1 ? 's' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {room.name}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      <span className="font-medium uppercase tracking-wide text-[0.6875rem]">
                        {getSharedWorkoutRoomStatusLabel(room.status)}
                      </span>
                      {' · '}
                      {room.memberCount} participant
                      {room.memberCount > 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SharedWorkoutJoinSheet
        open={joinSheetOpen}
        onClose={() => setJoinSheetOpen(false)}
      />
    </main>
  );
}
