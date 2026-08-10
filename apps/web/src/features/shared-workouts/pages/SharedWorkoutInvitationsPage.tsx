import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { sharedWorkoutReceivedInvitationsQueryOptions } from '../api/shared-workout-query-options';
import {
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} from '../hooks/use-shared-workout-mutations';
import { getSharedWorkoutInvitationStatusLabel } from '../lib/shared-workout-labels';

export function SharedWorkoutInvitationsPage() {
  const query = useQuery(
    sharedWorkoutReceivedInvitationsQueryOptions({ status: 'PENDING' }),
  );
  const acceptMutation = useAcceptInvitationMutation();
  const declineMutation = useDeclineInvitationMutation();
  const [error, setError] = useState<string | null>(null);
  const [acceptedRoomId, setAcceptedRoomId] = useState<string | null>(null);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const items = query.data?.data ?? [];

  async function handleAccept(invitationId: string) {
    if (offline) {
      setError(
        'Une connexion est nécessaire pour gérer les invitations et les membres.',
      );
      return;
    }
    setError(null);
    try {
      const result = await acceptMutation.mutateAsync(invitationId);
      setAcceptedRoomId(result.room.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’accepter l’invitation.'));
    }
  }

  async function handleDecline(invitationId: string) {
    if (offline) {
      setError(
        'Une connexion est nécessaire pour gérer les invitations et les membres.',
      );
      return;
    }
    setError(null);
    try {
      await declineMutation.mutateAsync(invitationId);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de refuser l’invitation.'));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <ButtonLink
          to="/shared-workouts"
          variant="ghost"
          className="mb-3 w-fit gap-2 px-0"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Séances partagées
        </ButtonLink>
        <h1 className="text-2xl font-bold tracking-tight">Invitations reçues</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Accepte ou refuse les invitations à rejoindre une salle.
        </p>
      </div>

      {offline ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm"
        >
          Une connexion est nécessaire pour gérer les invitations et les
          membres.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      {acceptedRoomId ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm"
        >
          Invitation acceptée.{' '}
          <Link
            to={`/shared-workouts/${acceptedRoomId}`}
            className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Ouvrir la salle
          </Link>
        </p>
      ) : null}

      {query.isLoading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : null}

      {query.isError ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {getApiErrorMessage(query.error, 'Impossible de charger les invitations.')}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <section className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-6">
          <h2 className="text-lg font-semibold">Aucune invitation en attente</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Les invitations reçues apparaîtront ici.
          </p>
        </section>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4"
          >
            <div>
              <p className="font-semibold">{invitation.room.name}</p>
              <p className="text-sm text-[var(--muted)]">
                Invité par {invitation.inviter.displayName ?? 'un utilisateur'}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {getSharedWorkoutInvitationStatusLabel(invitation.status)}
              </p>
            </div>
            {invitation.status === 'PENDING' ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    offline ||
                    acceptMutation.isPending ||
                    declineMutation.isPending
                  }
                  onClick={() => void handleAccept(invitation.id)}
                >
                  Accepter
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    offline ||
                    acceptMutation.isPending ||
                    declineMutation.isPending
                  }
                  onClick={() => void handleDecline(invitation.id)}
                >
                  Refuser
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
