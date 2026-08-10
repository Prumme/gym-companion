import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Users } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  sharedWorkoutRoomDetailQueryOptions,
  sharedWorkoutRoomInvitationsQueryOptions,
} from '../api/shared-workout-query-options';
import { SharedWorkoutMySessionSection } from '../components/SharedWorkoutMySessionSection';
import {
  useCancelRoomInvitationMutation,
  useCancelSharedWorkoutRoomMutation,
  useCompleteSharedWorkoutRoomMutation,
  useInviteSharedWorkoutRoomMutation,
  useLeaveSharedWorkoutRoomMutation,
  useStartSharedWorkoutRoomMutation,
  useUpdateSharedWorkoutRoomMutation,
} from '../hooks/use-shared-workout-mutations';
import { useSharedWorkoutRoomRealtime } from '../hooks/use-shared-workout-room-realtime';
import {
  getSharedWorkoutInvitationStatusLabel,
  getSharedWorkoutRoomStatusLabel,
  memberWorkoutLabel,
} from '../lib/shared-workout-labels';

function createClientCommandId(): string {
  return crypto.randomUUID();
}

export function SharedWorkoutRoomDetailPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery(sharedWorkoutRoomDetailQueryOptions(roomId));
  const updateMutation = useUpdateSharedWorkoutRoomMutation(roomId);
  const startMutation = useStartSharedWorkoutRoomMutation(roomId);
  const completeMutation = useCompleteSharedWorkoutRoomMutation(roomId);
  const cancelMutation = useCancelSharedWorkoutRoomMutation(roomId);
  const inviteMutation = useInviteSharedWorkoutRoomMutation(roomId);
  const cancelInviteMutation = useCancelRoomInvitationMutation(roomId);
  const leaveMutation = useLeaveSharedWorkoutRoomMutation(roomId);

  const room = query.data;
  const { connectedUserIds, connectionStatus, realtimeAvailable } =
    useSharedWorkoutRoomRealtime(roomId, room?.status);
  const canManageInvites = Boolean(
    room?.isOwner &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE'),
  );
  const invitationsQuery = useQuery({
    ...sharedWorkoutRoomInvitationsQueryOptions(roomId),
    enabled: Boolean(roomId) && canManageInvites,
  });

  const [renameOpen, setRenameOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  const pending =
    updateMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    inviteMutation.isPending ||
    cancelInviteMutation.isPending ||
    leaveMutation.isPending;

  const canMutateLifecycle = useMemo(
    () => Boolean(room?.isOwner && !offline),
    [room?.isOwner, offline],
  );

  const isActiveMember = Boolean(
    room && !room.isOwner && (room.status === 'LOBBY' || room.status === 'ACTIVE'),
  );

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ name: nameDraft });
      setRenameOpen(false);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Impossible de renommer la salle.'),
      );
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (offline) {
      setActionError(
        'Une connexion est nécessaire pour gérer les invitations et les membres.',
      );
      return;
    }
    setActionError(null);
    setInviteSuccess(null);
    try {
      await inviteMutation.mutateAsync({ inviteeEmail: inviteEmail });
      setInviteSuccess('Invitation envoyée.');
      setInviteEmail('');
      setInviteOpen(false);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Impossible d’envoyer l’invitation.'),
      );
    }
  }

  async function runLifecycle(
    action: 'start' | 'complete' | 'cancel',
    confirmMessage: string,
  ) {
    if (!window.confirm(confirmMessage)) return;
    setActionError(null);
    try {
      const commandId = createClientCommandId();
      if (action === 'start') await startMutation.mutateAsync(commandId);
      if (action === 'complete') await completeMutation.mutateAsync(commandId);
      if (action === 'cancel') await cancelMutation.mutateAsync(commandId);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Action impossible pour le moment.'),
      );
    }
  }

  function buildCompleteConfirmMessage(): string {
    const inProgress = (room?.members ?? []).filter((member) => {
      const status = member.memberWorkout?.status;
      return status === 'ACTIVE' || status === 'PAUSED';
    }).length;
    if (inProgress > 0) {
      return `${inProgress} membre${inProgress > 1 ? 's' : ''} ${inProgress > 1 ? 'ont' : 'a'} encore une séance en cours.\nTerminer la salle ne terminera pas leurs séances personnelles.\n\nTerminer la séance partagée ?`;
    }
    return 'Terminer la séance partagée ?';
  }

  async function handleLeave() {
    const meId = queryClient.getQueryData<{ data: { id: string } }>([
      'me',
    ])?.data?.id;
    const selfMember = room?.members.find((member) => member.userId === meId);
    const selfInProgress =
      selfMember?.memberWorkout.status === 'ACTIVE' ||
      selfMember?.memberWorkout.status === 'PAUSED';

    const leaveMessage = selfInProgress
      ? 'Ta séance personnelle restera active après avoir quitté la salle.\n\nQuitter cette séance partagée ?'
      : 'Quitter cette séance partagée ?\n\nTu n’auras plus accès à cette salle après l’avoir quittée.';

    if (!window.confirm(leaveMessage)) {
      return;
    }
    if (offline) {
      setActionError(
        'Une connexion est nécessaire pour gérer les invitations et les membres.',
      );
      return;
    }
    setActionError(null);
    try {
      await leaveMutation.mutateAsync();
      void navigate('/shared-workouts', { replace: true });
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Impossible de quitter la salle.'),
      );
    }
  }

  if (query.isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-[var(--muted)]">Chargement de la salle…</p>
      </main>
    );
  }

  if (query.isError || !room) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/shared-workouts" variant="ghost" className="w-fit gap-2 px-0">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour
        </ButtonLink>
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {getApiErrorMessage(query.error, 'Salle introuvable.')}
        </p>
      </main>
    );
  }

  const statusLabel = getSharedWorkoutRoomStatusLabel(room.status);
  const invitations = invitationsQuery.data?.data ?? [];

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Statut :{' '}
              <span className="font-medium text-[var(--foreground)]">
                {statusLabel}
              </span>
            </p>
          </div>
          {room.isOwner &&
          (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
          !offline ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => {
                setNameDraft(room.name);
                setRenameOpen(true);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Renommer
            </Button>
          ) : null}
        </div>
      </div>

      {offline ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm"
        >
          Une connexion est nécessaire pour gérer les invitations et les
          membres. Présence indisponible hors connexion.
        </p>
      ) : null}

      {!offline &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
      connectionStatus === 'error' ? (
        <p role="status" className="text-sm text-[var(--muted)]">
          Présence temps réel indisponible — la salle reste utilisable.
        </p>
      ) : null}

      {!offline &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
      connectionStatus === 'connected' ? (
        <p className="text-xs text-[var(--muted)]">Temps réel connecté</p>
      ) : null}

      {!offline &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
      connectionStatus === 'connecting' ? (
        <p className="text-xs text-[var(--muted)]">Reconnexion…</p>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {actionError}
        </p>
      ) : null}

      {inviteSuccess ? (
        <p role="status" className="text-sm text-[var(--foreground)]">
          {inviteSuccess}
        </p>
      ) : null}

      {renameOpen ? (
        <form
          onSubmit={handleRename}
          className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nom de la salle</span>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={80}
              required
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !nameDraft.trim()}>
              Enregistrer
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameOpen(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}

      <section
        aria-labelledby="members-heading"
        className="rounded-[var(--radius)] border border-[var(--border)] p-4"
      >
        <h2
          id="members-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Users className="size-5" aria-hidden="true" />
          Membres ({room.members.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {room.members.map((member) => {
            const isOnline = connectedUserIds.has(member.userId);
            const presenceLabel = !realtimeAvailable
              ? 'Présence inconnue'
              : isOnline
                ? 'En ligne'
                : 'Hors ligne';
            const workoutLabel = memberWorkoutLabel(
              member.memberWorkout.status,
              member.memberWorkout.workoutName,
            );
            return (
              <li
                key={member.userId}
                className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {member.displayName ?? 'Participant'}
                    {member.role === 'OWNER' ? ' (propriétaire)' : ''}
                  </p>
                  <p className="text-[var(--muted)]">Séance : {workoutLabel}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-[var(--muted)]">
                  <span
                    aria-hidden="true"
                    className={`inline-block size-2 rounded-full ${
                      realtimeAvailable && isOnline
                        ? 'bg-emerald-500'
                        : 'bg-[var(--muted)]'
                    }`}
                  />
                  <span>{presenceLabel}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <SharedWorkoutMySessionSection
        roomId={roomId}
        roomStatus={room.status}
        myWorkoutSessionId={room.myWorkoutSessionId}
        offline={offline}
      />

      {canManageInvites ? (
        <section
          aria-labelledby="invitations-heading"
          className="rounded-[var(--radius)] border border-[var(--border)] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="invitations-heading" className="text-lg font-semibold">
              Invitations
            </h2>
            {!inviteOpen ? (
              <Button
                type="button"
                variant="secondary"
                disabled={offline || pending}
                onClick={() => setInviteOpen(true)}
              >
                Inviter quelqu’un
              </Button>
            ) : null}
          </div>

          {inviteOpen ? (
            <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Adresse e-mail du compte</span>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  autoComplete="off"
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending || offline}>
                  Envoyer l’invitation
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setInviteOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}

          {invitationsQuery.isLoading ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Chargement des invitations…
            </p>
          ) : null}

          <ul className="mt-3 flex flex-col gap-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {invitation.invitee.displayName ?? 'Invité'} —{' '}
                  {getSharedWorkoutInvitationStatusLabel(invitation.status)}
                </span>
                {invitation.status === 'PENDING' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending || offline}
                    onClick={() =>
                      void cancelInviteMutation.mutateAsync(invitation.id).catch(
                        (error: unknown) => {
                          setActionError(
                            getApiErrorMessage(
                              error,
                              'Impossible d’annuler l’invitation.',
                            ),
                          );
                        },
                      )
                    }
                  >
                    Annuler l’invitation
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 text-sm text-[var(--muted)]">
        <p>
          Propriétaire :{' '}
          <span className="text-[var(--foreground)]">
            {room.owner.displayName ?? 'Utilisateur'}
          </span>
        </p>
        {room.startedAt ? (
          <p>Démarrée : {new Date(room.startedAt).toLocaleString('fr-FR')}</p>
        ) : null}
        {room.completedAt ? (
          <p>Terminée : {new Date(room.completedAt).toLocaleString('fr-FR')}</p>
        ) : null}
        {room.cancelledAt ? (
          <p>Annulée : {new Date(room.cancelledAt).toLocaleString('fr-FR')}</p>
        ) : null}
      </section>

      {room.status === 'LOBBY' && canMutateLifecycle ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">
            Cela démarre la salle de coordination, pas encore une séance
            individuelle.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              void runLifecycle('start', 'Démarrer la séance partagée ?')
            }
          >
            Démarrer la séance partagée
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void runLifecycle('cancel', 'Annuler cette salle ?')}
          >
            Annuler la salle
          </Button>
        </div>
      ) : null}

      {room.status === 'ACTIVE' ? (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium">Séance partagée en cours</p>
          {canMutateLifecycle ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  void runLifecycle('complete', buildCompleteConfirmMessage())
                }
              >
                Terminer
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  void runLifecycle('cancel', 'Annuler cette salle active ?')
                }
              >
                Annuler
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {room.status === 'COMPLETED' ? (
        <p className="text-base font-medium">Séance partagée terminée</p>
      ) : null}

      {room.status === 'CANCELLED' ? (
        <p className="text-base font-medium">Séance partagée annulée</p>
      ) : null}

      {isActiveMember && !offline ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => void handleLeave()}
        >
          Quitter la salle
        </Button>
      ) : null}

      {!room.isOwner &&
      room.status !== 'COMPLETED' &&
      room.status !== 'CANCELLED' ? (
        <p className="text-sm text-[var(--muted)]">
          Vue lecture seule — seul le propriétaire peut démarrer ou terminer la
          salle.
        </p>
      ) : null}

      <Link
        to="/shared-workouts"
        className="text-sm text-[var(--primary)] underline-offset-2 hover:underline"
      >
        Retour à la liste
      </Link>
    </main>
  );
}
