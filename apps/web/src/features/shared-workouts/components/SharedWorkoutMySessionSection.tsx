import { useQuery } from '@tanstack/react-query';
import type { SharedWorkoutRoomStatus } from '@gym-companion/shared';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  activeProgramQueryOptions,
  programDetailQueryOptions,
} from '@/features/programs/api/program-query-options';
import { getWorkoutStatusLabel } from '@/features/workouts/lib/workout-labels';
import { getApiErrorMessage } from '@/lib/api/client';

import { mySharedWorkoutSessionQueryOptions } from '../api/shared-workout-query-options';
import {
  useAttachMySharedWorkoutSessionMutation,
  useCreateMySharedWorkoutSessionMutation,
} from '../hooks/use-shared-workout-mutations';
import {
  formatSharedExerciseProgress,
} from '../lib/shared-workout-labels';

type Props = {
  roomId: string;
  roomStatus: SharedWorkoutRoomStatus;
  myWorkoutSessionId: string | null;
  offline: boolean;
  /** Coarse progress for self from room members (privacy-safe). */
  selfExerciseName?: string | null;
  selfExerciseProgress?: { processed: number; total: number } | null;
  variant?: 'lobby' | 'active' | 'terminal';
};

export function SharedWorkoutMySessionSection({
  roomId,
  roomStatus,
  myWorkoutSessionId,
  offline,
  selfExerciseName = null,
  selfExerciseProgress = null,
  variant,
}: Props) {
  const mode =
    variant ??
    (roomStatus === 'LOBBY'
      ? 'lobby'
      : roomStatus === 'ACTIVE'
        ? 'active'
        : 'terminal');

  const myQuery = useQuery({
    ...mySharedWorkoutSessionQueryOptions(roomId),
    enabled: mode === 'active' || Boolean(myWorkoutSessionId),
  });
  const activeProgramQuery = useQuery({
    ...activeProgramQueryOptions(),
    enabled: mode === 'active' && !offline,
  });
  const activeProgramId = activeProgramQuery.data?.program.id;
  const programDetailQuery = useQuery({
    ...programDetailQueryOptions(activeProgramId ?? ''),
    enabled: Boolean(activeProgramId) && mode === 'active' && !offline,
  });

  const attachMutation = useAttachMySharedWorkoutSessionMutation(roomId);
  const createMutation = useCreateMySharedWorkoutSessionMutation(roomId);
  const [templateId, setTemplateId] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (mode === 'lobby') {
    return (
      <section aria-labelledby="my-workout-heading" className="flex flex-col gap-2">
        <h2
          id="my-workout-heading"
          className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          Ta séance
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Aucune séance liée. Tu pourras démarrer quand la salle sera lancée.
        </p>
      </section>
    );
  }

  if (mode === 'terminal') {
    const linkedId = myWorkoutSessionId ?? myQuery.data?.workoutSession?.id;
    return (
      <section aria-labelledby="my-workout-heading" className="flex flex-col gap-2">
        <h2
          id="my-workout-heading"
          className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          Ta séance
        </h2>
        {linkedId ? (
          <Link
            to={`/workouts/${linkedId}`}
            className="flex min-h-14 items-center justify-between gap-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {myQuery.data?.workoutSession?.workoutName ?? 'Séance rattachée'}
              </p>
              {myQuery.data?.workoutSession ? (
                <p className="text-sm text-[var(--muted)]">
                  {getWorkoutStatusLabel(myQuery.data.workoutSession.status)}
                </p>
              ) : null}
            </div>
            <span className="text-sm font-medium">Ouvrir →</span>
          </Link>
        ) : (
          <p className="text-sm text-[var(--muted)]">Aucune séance rattachée</p>
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
      setChooserOpen(false);
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
      setChooserOpen(false);
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, 'Impossible de démarrer la séance.'),
      );
    }
  }

  return (
    <section aria-labelledby="my-workout-heading" className="flex flex-col gap-3">
      <h2
        id="my-workout-heading"
        className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase"
      >
        Toi
      </h2>

      {offline ? (
        <p role="status" className="text-sm text-[var(--muted)]">
          Une connexion est nécessaire pour rattacher une séance à la salle.
        </p>
      ) : null}

      {localError ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {localError}
        </p>
      ) : null}

      {myQuery.isLoading ? (
        <div className="h-14 animate-pulse rounded-[var(--radius-control)] bg-[var(--border)]/60" />
      ) : null}

      {my?.linked && my.workoutSession ? (
        <Link
          to={`/workouts/${my.workoutSession.id}`}
          className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border)] py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {my.workoutSession.workoutName}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {getWorkoutStatusLabel(my.workoutSession.status)}
              {selfExerciseName ? ` · ${selfExerciseName}` : ''}
            </p>
            {selfExerciseProgress && selfExerciseProgress.total > 0 ? (
              <p className="text-sm text-[var(--muted)]">
                {formatSharedExerciseProgress(
                  selfExerciseProgress.processed,
                  selfExerciseProgress.total,
                )}
              </p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium shrink-0">
            Ouvrir
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      ) : null}

      {!my?.linked && !chooserOpen ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--muted)]">Aucune séance liée</p>
          <p className="text-sm text-[var(--muted)]">
            Choisis une séance existante ou démarre depuis un modèle.
          </p>
          <Button
            type="button"
            disabled={offline || pending}
            onClick={() => setChooserOpen(true)}
            className="w-fit"
          >
            Choisir une séance
          </Button>
        </div>
      ) : null}

      {!my?.linked && chooserOpen ? (
        <div className="flex flex-col gap-3">
          {my?.activeWorkoutElsewhere &&
          !my.activeWorkoutElsewhere.linkedToOtherRoom ? (
            <Button
              type="button"
              disabled={offline || pending}
              onClick={() => void handleAttach(my.activeWorkoutElsewhere!.id)}
            >
              Rattacher « {my.activeWorkoutElsewhere.workoutName} »
            </Button>
          ) : null}

          {my?.activeWorkoutElsewhere?.linkedToOtherRoom ? (
            <p className="text-sm text-[var(--muted)]">
              Ta séance en cours est déjà rattachée à une autre salle.
            </p>
          ) : null}

          {templates.length > 0 ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Modèle de séance</span>
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  disabled={offline || pending}
                  className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3"
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
          ) : !my?.activeWorkoutElsewhere ? (
            <p className="text-sm text-[var(--muted)]">
              Aucun modèle disponible dans le programme actif.
            </p>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={() => setChooserOpen(false)}
          >
            Annuler
          </Button>
        </div>
      ) : null}
    </section>
  );
}
