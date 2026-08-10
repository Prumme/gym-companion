import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';

import { ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { sharedWorkoutRoomsListQueryOptions } from '../api/shared-workout-query-options';
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Séances partagées</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Prépare une salle privée pour t’entraîner à plusieurs.
          </p>
        </div>
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
      </div>

      {offline ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm"
        >
          Une connexion est nécessaire pour gérer une séance partagée.
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Filtrer par statut"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={
              statusFilter === filter.value
                ? 'rounded-full border border-[var(--primary)] px-3 py-1 text-xs font-medium text-[var(--primary)]'
                : 'rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]'
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Chargement des salles…</p>
      ) : null}

      {query.isError ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {getApiErrorMessage(query.error, 'Impossible de charger les salles.')}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && sorted.length === 0 ? (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] p-6">
          <Users className="size-8 text-[var(--muted)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Aucune séance partagée</h2>
          <p className="text-sm text-[var(--muted)]">
            Crée une salle pour préparer une séance à plusieurs.
          </p>
          <ButtonLink to="/shared-workouts/new">Créer une salle</ButtonLink>
        </section>
      ) : null}

      <ul className="flex flex-col gap-3">
        {sorted.map((room) => (
          <li key={room.id}>
            <Link
              to={`/shared-workouts/${room.id}`}
              className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] p-4 hover:bg-[var(--card)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{room.name}</span>
                <span className="text-xs font-medium text-[var(--muted)]">
                  {getSharedWorkoutRoomStatusLabel(room.status)}
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {room.memberCount} membre{room.memberCount > 1 ? 's' : ''} ·{' '}
                {room.owner.displayName ?? 'Propriétaire'}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Mise à jour{' '}
                {new Date(room.updatedAt).toLocaleString('fr-FR')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
