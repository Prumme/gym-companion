import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { WorkoutSessionDetail } from '@gym-companion/shared';

import { getMe } from '@/features/profile/api/profile-api';

import { workoutQueryKeys } from '../api/workout-query-keys';
import { personalRecordQueryKeys } from '@/features/personal-records/api/personal-record-query-keys';
import { progressQueryKeys } from '@/features/progress/api/progress-query-keys';
import { coachingQueryKeys } from '@/features/coaching/api/coaching-query-keys';
import { subscribeWorkoutSync } from '../offline/broadcast';
import {
  discardLocalChanges,
  loadConflictContext,
  rebaseLocalChanges,
} from '../offline/conflict';
import { getSyncState, listOpenCommands } from '../offline/store';
import { syncWorkoutSession } from '../offline/sync-engine';
import type { StoredWorkoutCommand, WorkoutSyncStatus } from '../offline/types';

function applySyncedSessionToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  session: WorkoutSessionDetail | null,
) {
  if (!session) {
    queryClient.setQueryData(workoutQueryKeys.active(), null);
    return;
  }
  const inProgress =
    session.status === 'ACTIVE' || session.status === 'PAUSED';
  queryClient.setQueryData(
    workoutQueryKeys.active(),
    inProgress ? session : null,
  );
  queryClient.setQueryData(workoutQueryKeys.detail(session.id), session);
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    void queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.historyLists(),
    });
    void queryClient.invalidateQueries({
      queryKey: workoutQueryKeys.pendingTerminalLocal(),
    });
  }
  if (session.status === 'COMPLETED') {
    void queryClient.invalidateQueries({
      queryKey: personalRecordQueryKeys.all,
    });
    void queryClient.invalidateQueries({
      queryKey: progressQueryKeys.all,
    });
    void queryClient.invalidateQueries({
      queryKey: coachingQueryKeys.all,
    });
  }
}

export function useCurrentUserId(): string | null {
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  return meQuery.data?.data.id ?? null;
}

export function useWorkoutOfflineSync(workoutSessionId: string | null) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WorkoutSyncStatus>('IDLE');
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCommandId, setConflictCommandId] = useState<string | null>(
    null,
  );
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [conflictCommand, setConflictCommand] =
    useState<StoredWorkoutCommand | null>(null);
  const [browserOffline, setBrowserOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  );

  const refresh = useCallback(async () => {
    if (!userId || !workoutSessionId) {
      setStatus('IDLE');
      setPendingCount(0);
      setConflictCommandId(null);
      setConflictCommand(null);
      return;
    }
    const state = await getSyncState(userId, workoutSessionId);
    const open = await listOpenCommands(userId, workoutSessionId);
    setPendingCount(open.length);
    setStatus(
      state?.status ??
        (open.length > 0
          ? typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'OFFLINE'
            : 'PENDING'
          : 'IDLE'),
    );
    setConflictCommandId(state?.conflictCommandId ?? null);
    setLastErrorMessage(state?.lastErrorMessage ?? null);
    if (state?.status === 'CONFLICT' || state?.status === 'ERROR') {
      const ctx = await loadConflictContext(userId, workoutSessionId);
      setConflictCommand(ctx.conflict);
    } else {
      setConflictCommand(null);
    }
  }, [userId, workoutSessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => {
      setBrowserOffline(false);
      if (userId && workoutSessionId) {
        void syncWorkoutSession(userId, workoutSessionId, {
          force: true,
          onSessionUpdated: (session) =>
            applySyncedSessionToCache(queryClient, session),
        }).then(() => refresh());
      }
    };
    const onOffline = () => {
      setBrowserOffline(true);
      void refresh();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const onFocus = () => {
      void refresh();
      if (userId && workoutSessionId && navigator.onLine) {
        void syncWorkoutSession(userId, workoutSessionId, {
          onSessionUpdated: (session) =>
            applySyncedSessionToCache(queryClient, session),
        }).then(() => refresh());
      }
    };
    window.addEventListener('focus', onFocus);
    const unsub = subscribeWorkoutSync((event) => {
      if (
        event.userId === userId &&
        event.workoutSessionId === workoutSessionId
      ) {
        void refresh();
      }
    });
    const interval = window.setInterval(() => {
      if (pendingCount > 0 || status === 'SYNCING') {
        void refresh();
      }
    }, 2000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onFocus);
      unsub();
      window.clearInterval(interval);
    };
  }, [
    userId,
    workoutSessionId,
    queryClient,
    refresh,
    pendingCount,
    status,
  ]);

  const syncNow = useCallback(async () => {
    if (!userId || !workoutSessionId) return;
    if (status === 'CONFLICT') return;
    await syncWorkoutSession(userId, workoutSessionId, {
      force: true,
      onSessionUpdated: (session) =>
        applySyncedSessionToCache(queryClient, session),
    });
    await refresh();
  }, [userId, workoutSessionId, status, queryClient, refresh]);

  const keepServer = useCallback(async () => {
    if (!userId || !workoutSessionId) return;
    const server = await discardLocalChanges({
      userId,
      workoutSessionId,
    });
    applySyncedSessionToCache(queryClient, server);
    await refresh();
  }, [userId, workoutSessionId, queryClient, refresh]);

  const reapplyLocal = useCallback(async () => {
    if (!userId || !workoutSessionId) {
      return {
        ok: false as const,
        reason: 'Utilisateur inconnu.',
        failedCommandId: null,
      };
    }
    const result = await rebaseLocalChanges({ userId, workoutSessionId });
    if (result.ok) {
      queryClient.setQueryData(workoutQueryKeys.active(), result.session);
      queryClient.setQueryData(
        workoutQueryKeys.detail(result.session.id),
        result.session,
      );
      await syncNow();
    }
    await refresh();
    return result;
  }, [userId, workoutSessionId, queryClient, refresh, syncNow]);

  const label = (() => {
    if (status === 'CONFLICT') {
      return 'Conflit de synchronisation';
    }
    if (status === 'SYNCING') {
      return pendingCount > 0
        ? `Synchronisation…`
        : 'Synchronisation…';
    }
    if (status === 'OFFLINE' || browserOffline) {
      return pendingCount > 0
        ? `Hors ligne — ${pendingCount} modification${pendingCount > 1 ? 's' : ''} en attente`
        : 'Hors ligne';
    }
    if (status === 'PENDING' || pendingCount > 0) {
      return `${pendingCount} modification${pendingCount > 1 ? 's' : ''} en attente`;
    }
    if (status === 'ERROR') {
      return lastErrorMessage ?? 'Erreur de synchronisation';
    }
    return 'En ligne';
  })();

  return {
    userId,
    status,
    pendingCount,
    conflictCommandId,
    conflictCommand,
    lastErrorMessage,
    browserOffline,
    label,
    syncNow,
    keepServer,
    reapplyLocal,
    refresh,
  };
}
