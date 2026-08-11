import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/button';
import type { ContextMenuItem } from '@/features/programs/components/ContextMenu';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  mySharedEquipmentQueryOptions,
  sharedWorkoutRoomDetailQueryOptions,
  sharedWorkoutRoomInvitationsQueryOptions,
} from '../api/shared-workout-query-options';
import { SharedParticipantRow } from '../components/SharedParticipantRow';
import { SharedRoomHeader } from '../components/SharedRoomHeader';
import { SharedWorkoutEquipmentSection } from '../components/SharedWorkoutEquipmentSection';
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
import { getSharedWorkoutInvitationStatusLabel } from '../lib/shared-workout-labels';

function createClientCommandId(): string {
  return crypto.randomUUID();
}

export function SharedWorkoutRoomDetailPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const viewerId = meQuery.data?.data.id ?? null;

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
    room?.isOwner && (room.status === 'LOBBY' || room.status === 'ACTIVE'),
  );
  const invitationsQuery = useQuery({
    ...sharedWorkoutRoomInvitationsQueryOptions(roomId),
    enabled: Boolean(roomId) && canManageInvites,
  });
  const myEquipmentQuery = useQuery({
    ...mySharedEquipmentQueryOptions(roomId),
    enabled: Boolean(roomId) && room?.status === 'ACTIVE',
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

  const canMutateLifecycle = Boolean(room?.isOwner && !offline);
  const isActiveMember = Boolean(
    room && !room.isOwner && (room.status === 'LOBBY' || room.status === 'ACTIVE'),
  );

  const onlineCount = useMemo(() => {
    if (!room || !realtimeAvailable) return null;
    return room.members.filter((m) => connectedUserIds.has(m.userId)).length;
  }, [room, connectedUserIds, realtimeAvailable]);

  const selfMember = useMemo(() => {
    if (!room || !viewerId) return null;
    return room.members.find((m) => m.userId === viewerId) ?? null;
  }, [room, viewerId]);

  const otherMembers = useMemo(() => {
    if (!room) return [];
    if (!viewerId) return room.members;
    return room.members.filter((m) => m.userId !== viewerId);
  }, [room, viewerId]);

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
    const parts: string[] = [];
    if (inProgress > 0) {
      parts.push(
        `${inProgress} membre${inProgress > 1 ? 's' : ''} ${inProgress > 1 ? 'ont' : 'a'} encore une séance en cours.`,
      );
      parts.push(
        'Terminer la salle ne terminera pas leurs séances personnelles.',
      );
    }
    parts.push('Les équipements partagés seront libérés.');
    parts.push('Terminer la séance partagée ?');
    return parts.join('\n\n');
  }

  async function handleLeave() {
    const selfInProgress =
      selfMember?.memberWorkout.status === 'ACTIVE' ||
      selfMember?.memberWorkout.status === 'PAUSED';
    const usingEquipment = myEquipmentQuery.data?.state === 'USING';
    const leaveMessage = [
      selfInProgress
        ? 'Ta séance personnelle restera active après avoir quitté la salle.'
        : null,
      usingEquipment
        ? 'Tu utilises actuellement un équipement partagé. Il sera libéré automatiquement si tu quittes la salle.'
        : null,
      'Quitter cette séance partagée ?',
      !selfInProgress
        ? 'Tu n’auras plus accès à cette salle après l’avoir quittée.'
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!window.confirm(leaveMessage)) return;
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

  function presenceFor(userId: string): boolean | null {
    if (!realtimeAvailable) return null;
    return connectedUserIds.has(userId);
  }

  if (query.isLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded bg-[var(--border)]/60" />
        <div className="h-10 w-64 animate-pulse rounded bg-[var(--border)]/60" />
        <div className="h-32 animate-pulse rounded bg-[var(--border)]/60" />
      </main>
    );
  }

  if (query.isError || !room) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <ButtonLink to="/shared-workouts" variant="ghost" className="w-fit">
          ← Partagées
        </ButtonLink>
        <p role="alert" className="text-sm text-[var(--danger)]">
          {getApiErrorMessage(query.error, 'Salle introuvable.')}
        </p>
      </main>
    );
  }

  const invitations = invitationsQuery.data?.data ?? [];
  const isTerminal =
    room.status === 'COMPLETED' || room.status === 'CANCELLED';
  const showProgress =
    room.status === 'ACTIVE' ||
    room.status === 'COMPLETED' ||
    room.status === 'CANCELLED';

  const menuItems: ContextMenuItem[] = [];
  if (room.isOwner && (room.status === 'LOBBY' || room.status === 'ACTIVE') && !offline) {
    menuItems.push({
      label: 'Renommer',
      onSelect: () => {
        setNameDraft(room.name);
        setRenameOpen(true);
      },
    });
  }
  if (room.isOwner && room.status === 'ACTIVE' && canMutateLifecycle) {
    menuItems.push({
      label: 'Terminer',
      onSelect: () => {
        void runLifecycle('complete', buildCompleteConfirmMessage());
      },
    });
  }
  if (
    room.isOwner &&
    (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
    canMutateLifecycle
  ) {
    menuItems.push({
      label: 'Annuler la salle',
      destructive: true,
      onSelect: () => {
        void runLifecycle(
          'cancel',
          room.status === 'ACTIVE'
            ? 'Annuler cette salle active ?\n\nLes équipements partagés seront libérés.'
            : 'Annuler cette salle ?',
        );
      },
    });
  }
  if (isActiveMember && !offline) {
    menuItems.push({
      label: 'Quitter',
      destructive: true,
      onSelect: () => {
        void handleLeave();
      },
    });
  }

  function refetchRest() {
    void query.refetch();
    void invitationsQuery.refetch();
    void myEquipmentQuery.refetch();
  }

  const selfProgress = selfMember?.memberWorkout.progress;
  const selfExercise = selfMember?.memberWorkout.currentExercise;

  return (
    <main className="flex w-full flex-1 flex-col gap-6">
      <SharedRoomHeader
        name={room.name}
        status={room.status}
        onlineCount={onlineCount}
        menuItems={menuItems}
      />

      {offline ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          Une connexion est nécessaire pour gérer les invitations et les
          membres.
        </p>
      ) : null}

      {!offline &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
      connectionStatus === 'error' ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <p className="text-[var(--muted)]">
            Temps réel indisponible — actualisation manuelle possible.
          </p>
          <Button type="button" variant="secondary" onClick={refetchRest}>
            Actualiser
          </Button>
        </div>
      ) : null}

      {!offline &&
      (room.status === 'LOBBY' || room.status === 'ACTIVE') &&
      connectionStatus === 'connecting' ? (
        <p className="text-xs text-[var(--muted)]">Reconnexion…</p>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
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
          className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Nom de la salle</span>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              maxLength={80}
              required
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
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

      {room.status === 'ACTIVE' ? (
        <SharedWorkoutMySessionSection
          roomId={roomId}
          roomStatus={room.status}
          myWorkoutSessionId={room.myWorkoutSessionId}
          offline={offline}
          selfExerciseName={selfExercise?.name ?? null}
          selfExerciseProgress={
            selfProgress
              ? {
                  processed: selfProgress.processedExerciseCount,
                  total: selfProgress.totalExerciseCount,
                }
              : null
          }
        />
      ) : null}

      <section aria-labelledby="participants-heading">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2
            id="participants-heading"
            className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
          >
            {room.status === 'LOBBY' ? 'Participants' : 'Participants'}
            {' · '}
            {room.members.length}
          </h2>
          {canManageInvites && !inviteOpen ? (
            <Button
              type="button"
              variant="ghost"
              disabled={offline || pending}
              onClick={() => setInviteOpen(true)}
              className="min-h-11"
            >
              + Inviter
            </Button>
          ) : null}
        </div>

        {inviteOpen ? (
          <form
            onSubmit={handleInvite}
            className="mb-3 flex flex-col gap-3 rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Inviter quelqu’un</h3>
              <button
                type="button"
                aria-label="Fermer"
                className="inline-flex size-11 items-center justify-center"
                onClick={() => setInviteOpen(false)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">E-mail</span>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                autoComplete="off"
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
              />
            </label>
            <Button type="submit" disabled={pending || offline}>
              Envoyer l’invitation
            </Button>
          </form>
        ) : null}

        {canManageInvites && invitations.some((i) => i.status === 'PENDING') ? (
          <ul className="mb-3 flex flex-col gap-1 text-sm text-[var(--muted)]">
            {invitations
              .filter((i) => i.status === 'PENDING')
              .map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    {invitation.invitee.displayName ?? 'Invité'} —{' '}
                    {getSharedWorkoutInvitationStatusLabel(invitation.status)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending || offline}
                    onClick={() =>
                      void cancelInviteMutation
                        .mutateAsync(invitation.id)
                        .catch((error: unknown) => {
                          setActionError(
                            getApiErrorMessage(
                              error,
                              'Impossible d’annuler l’invitation.',
                            ),
                          );
                        })
                    }
                  >
                    Annuler
                  </Button>
                </li>
              ))}
          </ul>
        ) : null}

        <ul className="border-y border-[var(--border)]">
          {(room.status === 'LOBBY' ? room.members : otherMembers).map(
            (member) => (
              <SharedParticipantRow
                key={member.userId}
                member={member}
                online={presenceFor(member.userId)}
                showProgress={showProgress && room.status !== 'LOBBY'}
              />
            ),
          )}
        </ul>
      </section>

      {room.status === 'LOBBY' ? (
        <SharedWorkoutMySessionSection
          roomId={roomId}
          roomStatus={room.status}
          myWorkoutSessionId={room.myWorkoutSessionId}
          offline={offline}
        />
      ) : null}

      {isTerminal ? (
        <SharedWorkoutMySessionSection
          roomId={roomId}
          roomStatus={room.status}
          myWorkoutSessionId={room.myWorkoutSessionId}
          offline={offline}
        />
      ) : null}

      <SharedWorkoutEquipmentSection
        roomId={roomId}
        offline={offline}
        enabled={room.status === 'ACTIVE'}
      />

      {room.status === 'LOBBY' && canMutateLifecycle ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              void runLifecycle('start', 'Démarrer la séance partagée ?')
            }
          >
            Démarrer la séance
          </Button>
          <p className="text-sm text-[var(--muted)]">
            Cela démarre la coordination — pas encore une séance individuelle.
          </p>
        </div>
      ) : null}

      {isTerminal ? (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <p className="text-sm text-[var(--muted)]">
            {room.status === 'COMPLETED'
              ? room.completedAt
                ? `Séance partagée terminée le ${new Date(room.completedAt).toLocaleString('fr-FR')}`
                : 'Séance partagée terminée'
              : room.cancelledAt
                ? `Séance partagée annulée le ${new Date(room.cancelledAt).toLocaleString('fr-FR')}`
                : 'Séance partagée annulée'}
          </p>
          <ButtonLink to="/shared-workouts" variant="secondary" className="w-fit">
            Retour aux séances partagées
          </ButtonLink>
        </div>
      ) : null}
    </main>
  );
}
