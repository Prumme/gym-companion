import type { ApiRequestError } from '@/lib/api/client';

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const apiError = error as ApiRequestError;
  if (apiError.status === 0) {
    return true;
  }
  if (apiError.status != null && apiError.status >= 500) {
    return true;
  }
  const message = error.message.toLowerCase();
  return (
    error.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed')
  );
}

export function isAuthError(error: unknown): boolean {
  const apiError = error as ApiRequestError;
  return apiError?.status === 401 || apiError?.code === 'UNAUTHORIZED';
}

export function isConflictError(error: unknown): boolean {
  const apiError = error as ApiRequestError;
  return (
    apiError?.code === 'WORKOUT_VERSION_CONFLICT' ||
    (apiError?.status === 409 &&
      apiError?.code === 'WORKOUT_VERSION_CONFLICT')
  );
}

const BUSINESS_REJECT_CODES = new Set([
  'WORKOUT_NOT_EDITABLE',
  'WORKOUT_INVALID_STATUS_TRANSITION',
  'WORKOUT_NOT_FOUND',
  'WORKOUT_SET_NOT_FOUND',
  'WORKOUT_SET_COMMAND_CONFLICT',
  'WORKOUT_COMMAND_CONFLICT',
  'WORKOUT_SET_DUPLICATE_COMMAND',
  'WORKOUT_DUPLICATE_COMMAND',
  'VALIDATION_ERROR',
]);

export function isBusinessRejectError(error: unknown): boolean {
  const apiError = error as ApiRequestError;
  if (!apiError?.code) {
    return false;
  }
  if (apiError.code === 'WORKOUT_VERSION_CONFLICT') {
    return false;
  }
  return (
    BUSINESS_REJECT_CODES.has(apiError.code) ||
    apiError.status === 400 ||
    apiError.status === 404 ||
    (apiError.status === 409 && apiError.code !== 'WORKOUT_VERSION_CONFLICT')
  );
}

export function getErrorCode(error: unknown): string | null {
  return (error as ApiRequestError)?.code ?? null;
}

export function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }
  return null;
}
