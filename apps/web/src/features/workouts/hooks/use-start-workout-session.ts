import { todayLocalDateString } from '@gym-companion/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe } from '@/features/profile/api/profile-api';
import {
  getApiErrorMessage,
  type ApiRequestError,
} from '@/lib/api/client';

import { activeWorkoutQueryOptions } from '../api/workout-query-options';
import { useCreateWorkoutSessionMutation } from '../hooks/use-workout-mutations';

export type StartWorkoutConflict = {
  activeWorkoutSessionId: string | null;
  message: string;
};

export function useStartWorkoutSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateWorkoutSessionMutation();
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<StartWorkoutConflict | null>(null);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });

  const requestStart = useCallback(
    async (sourceWorkoutTemplateId: string) => {
      setError(null);
      setConflict(null);

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setError('Une connexion est nécessaire pour démarrer une séance.');
        return;
      }

      const cached = queryClient.getQueryData(
        activeWorkoutQueryOptions().queryKey,
      );
      let active = cached ?? null;
      if (cached === undefined) {
        active = await queryClient.fetchQuery(activeWorkoutQueryOptions());
      }

      if (active) {
        setConflict({
          activeWorkoutSessionId: active.id,
          message:
            'Une séance est déjà en cours. Ouvre-la pour continuer, ou termine-la plus tard.',
        });
        return;
      }

      setPendingTemplateId(sourceWorkoutTemplateId);
      setConfirmOpen(true);
    },
    [queryClient],
  );

  const confirmStart = useCallback(async () => {
    if (!pendingTemplateId) {
      return;
    }

    setError(null);
    const timezone =
      meQuery.data?.data.profile.timezone?.trim() || 'Europe/Paris';
    const localDate = todayLocalDateString(timezone);

    try {
      const detail = await createMutation.mutateAsync({
        sourceWorkoutTemplateId: pendingTemplateId,
        localDate,
        timezone,
      });
      setConfirmOpen(false);
      setPendingTemplateId(null);
      navigate('/workouts/active', { replace: false });
      return detail;
    } catch (err) {
      const apiError = err as ApiRequestError;
      if (apiError.code === 'WORKOUT_ACTIVE_ALREADY_EXISTS') {
        const details = apiError.details as
          | { activeWorkoutSessionId?: string }
          | undefined;
        setConfirmOpen(false);
        setConflict({
          activeWorkoutSessionId: details?.activeWorkoutSessionId ?? null,
          message:
            apiError.message ||
            'Une séance est déjà en cours. Ouvre-la pour continuer.',
        });
        void queryClient.invalidateQueries({
          queryKey: activeWorkoutQueryOptions().queryKey,
        });
        return;
      }

      if (
        apiError.message?.toLowerCase().includes('failed to fetch') ||
        apiError.message?.toLowerCase().includes('network')
      ) {
        setError('Une connexion est nécessaire pour démarrer une séance.');
        return;
      }

      setError(
        getApiErrorMessage(err, 'Impossible de démarrer cette séance.'),
      );
    }
  }, [
    createMutation,
    meQuery.data?.data.profile.timezone,
    navigate,
    pendingTemplateId,
    queryClient,
  ]);

  const cancelConfirm = useCallback(() => {
    if (createMutation.isPending) {
      return;
    }
    setConfirmOpen(false);
    setPendingTemplateId(null);
    setError(null);
  }, [createMutation.isPending]);

  const openActiveSession = useCallback(() => {
    setConflict(null);
    navigate('/workouts/active');
  }, [navigate]);

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  return {
    requestStart,
    confirmStart,
    cancelConfirm,
    confirmOpen,
    pending: createMutation.isPending,
    error,
    conflict,
    openActiveSession,
    dismissConflict,
  };
}
