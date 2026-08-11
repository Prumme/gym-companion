import {
  apiFetch,
  setAccessToken,
  type ApiRequestError,
} from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';

type AuthPayload = {
  data: {
    user: {
      id: string;
      email: string;
      status: string;
      emailVerified: boolean;
    };
    accessToken: string;
    expiresInSeconds: number;
  };
};

/** Single-flight : StrictMode / multi-appel ne relancent pas un 2e refresh. */
let bootstrapPromise: Promise<boolean> | null = null;

export async function register(input: {
  email: string;
  password: string;
  displayName?: string;
  acceptedTermsVersion: string;
}) {
  const result = await apiFetch<AuthPayload>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setAccessToken(result.data.accessToken);
  useAuthStore.getState().setSession(result.data.accessToken);
  return result.data;
}

export async function login(input: { email: string; password: string }) {
  const result = await apiFetch<AuthPayload>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setAccessToken(result.data.accessToken);
  useAuthStore.getState().setSession(result.data.accessToken);
  return result.data;
}

export async function logout() {
  try {
    await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
    useAuthStore.getState().clearSession();
  }
}

export async function forgotPassword(email: string) {
  return apiFetch<{ data: { message: string } }>('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiFetch<{ data: { message: string } }>('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

function isAuthFailure(error: unknown): boolean {
  const status = (error as ApiRequestError | undefined)?.status;
  return status === 401 || status === 403;
}

/**
 * Restaure la session via le refresh cookie HttpOnly.
 * À appeler une seule fois au démarrage (single-flight).
 *
 * - refresh OK → authenticated
 * - 401/403 → unauthenticated
 * - autre erreur (réseau/5xx) → unauthenticated (dette : pas de retry soft)
 */
export async function bootstrapSession(): Promise<boolean> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      const result = await apiFetch<AuthPayload>('/api/v1/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(result.data.accessToken);
      useAuthStore.getState().setSession(result.data.accessToken);
      return true;
    } catch (error) {
      setAccessToken(null);
      useAuthStore.getState().clearSession();
      if (!isAuthFailure(error)) {
        // Dette : une indisponibilité API au bootstrap se comporte comme déconnecté.
        // Le cookie HttpOnly peut rester valide ; un reload ultérieur retentera.
      }
      return false;
    } finally {
      // Garde le promise résolu pour les appels suivants (idempotent).
    }
  })();

  return bootstrapPromise;
}

/** Test-only : réinitialise le single-flight bootstrap. */
export function resetBootstrapSessionForTests() {
  bootstrapPromise = null;
}
