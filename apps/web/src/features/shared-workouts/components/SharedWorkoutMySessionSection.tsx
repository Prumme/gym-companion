import { useQuery } from '@tanstack/react-query';
import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';
import { useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { activeProgramQueryOptions } from '@/features/programs/api/program-query-options';
import { programDetailQueryOptions } from '@/features/programs/api/program-query-options';
import { getWorkoutStatusLabel } from '@/features/workouts/lib/workout-labels';
import { getApiErrorMessage } from '@/lib/api/client';

import { mySharedWorkoutSessionQueryOptions } from '../api/shared-workout-query-options';
import {
  useAttachMySharedWorkoutSessionMutation,
  useCreateMySharedWorkoutSessionMutation,
} from '../hooks/use-shared-workout-mutations';

type Props = {
  roomId: string;
  roomStatus: SharedWorkoutRoomStatus;
  myWorkoutSessionId: string | null;
  offline: boolean;
};

export function SharedWorkoutMySessionSection({
  roomId,
  roomStatus,
  myWorkoutSessionId,
  offline,
}: Props) {
  const myQuery = useQuery({
    ...mySharedWorkoutSessionQueryOptions(roomId),
    enabled: roomStatus === 'ACTIVE' || Boolean(myWorkoutSessionId),
  });
  const activeProgramQuery = useQuery({
    ...activeProgramQueryOptions(),
    enabled: roomStatus === 'ACTIVE' && !offline,
  });
  const activeProgramId = activeProgramQuery.data?.program.id;
  const programDetailQuery = useQuery({
    ...programDetailQueryOptions(activeProgramId ?? ''),
    enabled: Boolean(activeProgramId) && roomStatus === 'ACTIVE' && !offline,
  });

  const attachMutation = useAttachMySharedWorkoutSessionMutation(roomId);
  const createMutation = useCreateMySharedWorkoutSessionMutation(roomId);
  const [templateId, setTemplateId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (roomStatus === 'LOBBY') {
    return (
      <section
        aria-labelledby="my-workout-heading"
        className="rounded-[var(--radius)] border border-[var(--border)] p-4"
      >
        <h2 id="my-workout-heading" className="text-lg font-semibold">
          Ma séance
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Les séances individuelles pourront être démarrées lorsque la salle
          sera lancée.
        </p>
      </section>
    );
  }

  if (roomStatus === 'COMPLETED' || roomStatus === 'CANCELLED') {
    const linkedId = myWorkoutSessionId ?? myQuery.data?.workoutSession?.id;
    return (
      <section
        aria-labelledby="my-workout-heading"
        className="rounded-[var(--radius)] border border-[var(--border)] p-4"
      >
        <h2 id="my-workout-heading" className="text-lg font-semibold">
          Ma séance
        </h2>
        {linkedId ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">
              {myQuery.data?.workoutSession?.workoutName ?? 'Séance rattachée'}
              {myQuery.data?.workoutSession
                ? ` — ${getWorkoutStatusLabel(myQuery.data.workoutSession.status)}`
                : null}
            </p>
            <ButtonLink to={`/workouts/${linkedId}`} variant="secondary" className="w-fit">
              Ouvrir ma séance
            </ButtonLink>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Aucune séance rattachée
          </p>
        )}
      </section>
    );
  }

  // ACTIVE
  const my = myQuery.data;
  const pending = attachMutation.isPending || createMutation.isPending;
  const templates = programDetailQuery.data?.workoutTemplates ?? [];

  async function handleAttach(sessionId: string) {
    if (offline) {
      setLocalError(
        'Une connexion est nécessaire pour rattacher une séance à la salle.',
      );
      return;
    }
    setLocalError(null);
    try {
      await attachMutation.mutateAsync({ workoutSessionId: sessionId });
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de rattacher la séance.'),
      );
    }
  }

  async function handleCreate() {
    if (offline) {
      setLocalError(
        'Une connexion est nécessaire pour rattacher une séance à la salle.',
      );
      return;
    }
    if (!templateId) {
      setLocalError('Choisis un modèle de séance.');
      return;
    }
    setLocalError(null);
    try {
      await createMutation.mutateAsync({ workoutTemplateId: templateId });
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de démarrer la séance.'),
      );
    }
  }

  return (
    <section
      aria-labelledby="my-workout-heading"
      className="rounded-[var(--radius)] border border-[var(--border)] p-4"
    >
      <h2 id="my-workout-heading" className="text-lg font-semibold">
        Ma séance
      </h2>

      {offline ? (
        <p role="status" className="mt-2 text-sm text-[var(--muted)]">
          Une connexion est nécessaire pour rattacher une séance à la salle.
        </p>
      ) : null}

      {localError ? (
        <p role="alert" className="mt-2 text-sm text-[var(--destructive)]">
          {localError}
        </p>
      ) : null}

      {myQuery.isLoading ? (
        <p className="mt-2 text-sm text-[var(--muted)]">Chargement…</p>
      ) : null}

      {my?.linked && my.workoutSession ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm">
            <span className="font-medium">{my.workoutSession.workoutName}</span>
            {' — '}
            {getWorkoutStatusLabel(my.workoutSession.status)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Démarrée :{' '}
            {new Date(my.workoutSession.startedAt).toLocaleString('fr-FR')}
          </p>
          <ButtonLink to={`/workouts/${my.workoutSession.id}`} className="w-fit">
            Ouvrir ma séance
          </ButtonLink>
        </div>
      ) : null}

      {!my?.linked &&
      my?.activeWorkoutElsewhere &&
      !my.activeWorkoutElsewhere.linkedToOtherRoom ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm">
            Séance en cours :{' '}
            <span className="font-medium">
              {my.activeWorkoutElsewhere.workoutName}
            </span>{' '}
            ({getWorkoutStatusLabel(my.activeWorkoutElsewhere.status)})
          </p>
          <Button
            type="button"
            disabled={offline || pending}
            onClick={() => void handleAttach(my.activeWorkoutElsewhere!.id)}
          >
            Rattacher ma séance en cours
          </Button>
        </div>
      ) : null}

      {!my?.linked &&
      my?.activeWorkoutElsewhere?.linkedToOtherRoom ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Ta séance en cours est déjà rattachée à une autre salle.
        </p>
      ) : null}

      {!my?.linked && !my?.activeWorkoutElsewhere ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">Aucune séance rattachée</p>
          {templates.length > 0 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Modèle de séance</span>
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  disabled={offline || pending}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3"
                >
                  <option value="">Choisir…</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                disabled={offline || pending || !templateId}
                onClick={() => void handleCreate()}
              >
                Démarrer ma séance
              </Button>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Aucun modèle disponible dans le programme actif. Crée un programme
              ou active-en un pour démarrer.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
