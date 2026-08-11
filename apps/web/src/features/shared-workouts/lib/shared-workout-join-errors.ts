import {
  getApiErrorMessage,
  type ApiRequestError,
} from '@/lib/api/client';

export function getJoinSharedWorkoutErrorMessage(
  error: unknown,
  fallback = 'Impossible de rejoindre la salle pour le moment.',
): string {
  if (error instanceof TypeError) {
    return fallback;
  }

  const apiError = error as ApiRequestError;
  if (apiError.status === 429) {
    return 'Trop de tentatives. Réessaie dans un moment.';
  }
  if (
    apiError.status === 404 ||
    apiError.code === 'SHARED_WORKOUT_JOIN_CODE_INVALID'
  ) {
    return 'Code invalide ou expiré.';
  }

  return getApiErrorMessage(error, fallback);
}
