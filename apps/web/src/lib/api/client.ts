function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }

  // Fallback local uniquement en développement Vite.
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  throw new Error(
    'VITE_API_BASE_URL must be defined for production builds (see root .env / envDir).',
  );
}

const API_BASE_URL = resolveApiBaseUrl();

export type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ApiRequestError = Error & {
  code?: string;
  fieldErrors?: Record<string, string[]>;
  status?: number;
};

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getApiErrorMessage(error: unknown, fallback = 'Une erreur est survenue.') {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const json = (await response.json()) as { data: { accessToken: string } };
      accessToken = json.data.accessToken;
      return accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && !path.includes('/auth/login')) {
    const token = await refreshAccessToken();
    if (token) {
      return apiFetch<T>(path, init, false);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as T | { error: ApiError };
  if (!response.ok) {
    const error = (json as { error: ApiError }).error;
    const requestError: ApiRequestError = Object.assign(
      new Error(error?.message ?? 'Request failed'),
      {
        code: error?.code,
        fieldErrors: error?.fieldErrors,
        status: response.status,
      },
    );
    throw requestError;
  }

  return json as T;
}
