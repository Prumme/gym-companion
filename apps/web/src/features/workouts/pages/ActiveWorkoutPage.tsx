import type { WorkoutSessionDetail } from '@gym-companion/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage, type ApiRequestError } from '@/lib/api/client';

import { activeWorkoutQueryOptions } from '../api/workout-query-options';
import { workoutQueryKeys } from '../api/workout-query-keys';
import { ActiveExercisePanel } from '../components/ActiveExercisePanel';
import { ActiveWorkoutHeader } from '../components/ActiveWorkoutHeader';
import { ExerciseNavigator } from '../components/ExerciseNavigator';
import { RestTimer } from '../components/RestTimer';
import { WorkoutConflictPanel } from '../components/WorkoutConflictPanel';
import { WorkoutLifecycleActions } from '../components/WorkoutLifecycleActions';
import { WorkoutSyncBanner } from '../components/WorkoutSyncBanner';
import { useRestTimer } from '../hooks/use-rest-timer';
import { useWorkoutLifecycleControls } from '../hooks/use-workout-lifecycle-controls';
import { useWorkoutOfflineSync } from '../hooks/use-workout-offline-sync';
import { useWorkoutExerciseNavigation } from '../hooks/use-workout-exercise-navigation';
import {
  computeWorkoutProgress,
  findNextPendingSet,
  resolveRestSeconds,
  shouldAutoStartRest,
} from '../lib/workout-progress';

export function ActiveWorkoutPage() {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const userId = meQuery.data?.data.id ?? null;

  const query = useQuery({
    ...activeWorkoutQueryOptions(() => userId),
    enabled: meQuery.isSuccess || meQuery.isError,
    refetchOnWindowFocus: true,
  });
  const fromLocal =
    useQuery({
      queryKey: workoutQueryKeys.activeFromLocal(),
      queryFn: () => false,
      staleTime: Infinity,
      initialData: false,
    }).data === true;

  if (meQuery.isLoading || query.isLoading) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--danger)]" role="alert">
          {getApiErrorMessage(
            query.error,
            'Impossible de charger la séance en cours.',
          )}
        </p>
      </section>
    );
  }

  if (!query.data) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Séance en cours</h1>
        <p className="text-sm text-[var(--muted)]">Aucune séance en cours.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink to="/planning" variant="secondary">
            Consulter le planning
          </ButtonLink>
          <ButtonLink to="/programs" variant="secondary">
            Consulter les programmes
          </ButtonLink>
        </div>
      </section>
    );
  }

  return (
    <ActiveWorkoutSessionView
      session={query.data}
      fromLocalSnapshot={fromLocal}
      onRefetch={() => {
        void query.refetch();
      }}
    />
  );
}

function ActiveWorkoutSessionView({
  session,
  fromLocalSnapshot,
  onRefetch,
}: {
  session: WorkoutSessionDetail;
  fromLocalSnapshot: boolean;
  onRefetch: () => void;
}) {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeTimerPrompt, setResumeTimerPrompt] = useState(false);

  const offlineSync = useWorkoutOfflineSync(session.id);
  const navigation = useWorkoutExerciseNavigation(session);
  const restTimer = useRestTimer({
    workoutSessionId: session.id,
    enabled: true,
  });

  const lifecycle = useWorkoutLifecycleControls(session, {
    onVersionConflict: onRefetch,
    onPaused: () => {
      if (restTimer.isRunning) {
        restTimer.pause();
      }
    },
    onResumed: () => {
      if (restTimer.isPaused) {
        setResumeTimerPrompt(true);
      }
    },
  });

  const progress = useMemo(() => computeWorkoutProgress(session), [session]);
  const nextPending = useMemo(() => findNextPendingSet(session), [session]);
  const effortTrackingMode =
    meQuery.data?.data.profile.effortTrackingMode ?? 'NONE';
  const selectedExercise = navigation.selectedExercise;

  const manualRestSeconds =
    selectedExercise != null
      ? selectedExercise.restSeconds != null && selectedExercise.restSeconds > 0
        ? selectedExercise.restSeconds
        : selectedExercise.sets.find((set) => set.targetRestSeconds != null)
            ?.targetRestSeconds ?? null
      : null;

  return (
    <section className="flex flex-col gap-4 pb-28">
      <WorkoutSyncBanner
        label={offlineSync.label}
        status={offlineSync.status}
        pendingCount={offlineSync.pendingCount}
        browserOffline={offlineSync.browserOffline}
        fromLocalSnapshot={fromLocalSnapshot}
        onSyncNow={() => {
          void offlineSync.syncNow();
        }}
        syncDisabled={offlineSync.status === 'CONFLICT'}
      />

      {offlineSync.status === 'CONFLICT' ||
      (offlineSync.status === 'ERROR' && offlineSync.conflictCommand) ? (
        <WorkoutConflictPanel
          pendingCount={offlineSync.pendingCount}
          conflictCommand={offlineSync.conflictCommand}
          onKeepServer={offlineSync.keepServer}
          onReapplyLocal={offlineSync.reapplyLocal}
        />
      ) : null}

      <ActiveWorkoutHeader
        session={session}
        progress={progress}
        offline={false}
        pausePending={lifecycle.pausePending}
        resumePending={lifecycle.resumePending}
        onPause={
          session.permissions.canPause
            ? () => {
                void lifecycle.pause();
              }
            : undefined
        }
        onResume={
          session.permissions.canResume
            ? () => {
                void lifecycle.resume();
              }
            : undefined
        }
        onOpenComplete={
          session.permissions.canComplete
            ? () => setCompleteOpen(true)
            : undefined
        }
        onOpenCancel={
          session.permissions.canCancel
            ? () => setCancelOpen(true)
            : undefined
        }
      />

      {(lifecycle.pauseError as ApiRequestError | null)?.code ===
        'WORKOUT_VERSION_CONFLICT' ||
      (lifecycle.resumeError as ApiRequestError | null)?.code ===
        'WORKOUT_VERSION_CONFLICT' ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          La séance a été modifiée depuis un autre onglet ou appareil.
        </p>
      ) : null}

      {session.status === 'PAUSED' ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          Saisie des séries désactivée pendant la pause.
        </p>
      ) : null}

      {resumeTimerPrompt && restTimer.isPaused ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
          role="status"
        >
          <p className="text-sm">Reprendre la minuterie de repos locale ?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
              onClick={() => {
                restTimer.resume();
                setResumeTimerPrompt(false);
              }}
            >
              Reprendre le repos
            </button>
            <button
              type="button"
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
              onClick={() => setResumeTimerPrompt(false)}
            >
              Plus tard
            </button>
          </div>
        </div>
      ) : null}

      <ExerciseNavigator
        exercises={session.exercises}
        selectedExerciseId={navigation.selectedExerciseId}
        onSelect={navigation.selectExercise}
        onPrevious={navigation.goToPrevious}
        onNext={navigation.goToNext}
        hasPrevious={navigation.hasPrevious}
        hasNext={navigation.hasNext}
      />

      {selectedExercise ? (
        <ActiveExercisePanel
          session={session}
          exercise={selectedExercise}
          effortTrackingMode={effortTrackingMode}
          canRecordSets={session.permissions.canRecordSets}
          nextPendingSetId={nextPending?.setId ?? null}
          hasNextExercise={navigation.hasNext}
          onGoToNextExercise={navigation.goToNext}
          onVersionConflict={onRefetch}
          onSetRecorded={({ status, set, exercise }) => {
            if (!shouldAutoStartRest(status)) {
              return;
            }
            const rest = resolveRestSeconds(set, exercise);
            if (rest != null && rest > 0) {
              restTimer.start(rest, set.id);
            }
          }}
        />
      ) : null}

      <WorkoutLifecycleActions
        session={session}
        showInlineButtons={false}
        completeOpen={completeOpen}
        cancelOpen={cancelOpen}
        onCompleteOpenChange={setCompleteOpen}
        onCancelOpenChange={setCancelOpen}
        onVersionConflict={onRefetch}
        onPaused={() => {
          if (restTimer.isRunning) {
            restTimer.pause();
          }
        }}
        onResumed={() => {
          if (restTimer.isPaused) {
            setResumeTimerPrompt(true);
          }
        }}
        onTerminated={() => {
          restTimer.stop();
        }}
      />

      <RestTimer
        remainingSeconds={restTimer.remainingSeconds}
        isRunning={restTimer.isRunning}
        isPaused={restTimer.isPaused}
        justExpired={restTimer.justExpired}
        onPause={restTimer.pause}
        onResume={restTimer.resume}
        onStop={restTimer.stop}
        onAdd={restTimer.addSeconds}
        onDismissExpired={restTimer.clearExpiredBanner}
        canManualStart={
          session.status === 'ACTIVE' &&
          !restTimer.isRunning &&
          !restTimer.isPaused &&
          manualRestSeconds != null &&
          manualRestSeconds > 0
        }
        onManualStart={
          manualRestSeconds
            ? () => restTimer.start(manualRestSeconds, null)
            : undefined
        }
      />
    </section>
  );
}
