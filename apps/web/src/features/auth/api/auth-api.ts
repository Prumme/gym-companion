import { apiFetch, setAccessToken } from '@/lib/api/client';
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
  await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
  setAccessToken(null);
  useAuthStore.getState().clearSession();
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

export async function bootstrapSession() {
  try {
    const result = await apiFetch<AuthPayload>('/api/v1/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(result.data.accessToken);
    useAuthStore.getState().setSession(result.data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    useAuthStore.getState().clearSession();
    return false;
  }
}
