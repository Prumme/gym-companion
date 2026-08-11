import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapSession,
  resetBootstrapSessionForTests,
} from '@/features/auth/api/auth-api';
import { getAccessToken, setAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>(
    '@/lib/api/client',
  );
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from '@/lib/api/client';

const apiFetchMock = vi.mocked(apiFetch);

describe('bootstrapSession', () => {
  beforeEach(() => {
    resetBootstrapSessionForTests();
    setAccessToken(null);
    useAuthStore.setState({
      authStatus: 'initializing',
      accessToken: null,
      isAuthenticated: false,
    });
    apiFetchMock.mockReset();
  });

  it('passe authenticated quand le refresh réussit', async () => {
    apiFetchMock.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          email: 'a@test.local',
          status: 'ACTIVE',
          emailVerified: true,
        },
        accessToken: 'access-1',
        expiresInSeconds: 900,
      },
    });

    const ok = await bootstrapSession();
    expect(ok).toBe(true);
    expect(useAuthStore.getState().authStatus).toBe('authenticated');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(getAccessToken()).toBe('access-1');
  });

  it('passe unauthenticated quand le refresh échoue', async () => {
    apiFetchMock.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    const ok = await bootstrapSession();
    expect(ok).toBe(false);
    expect(useAuthStore.getState().authStatus).toBe('unauthenticated');
    expect(getAccessToken()).toBeNull();
  });

  it('n’exécute le refresh qu’une seule fois (single-flight)', async () => {
    let resolveFetch!: (value: unknown) => void;
    apiFetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = bootstrapSession();
    const second = bootstrapSession();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    resolveFetch({
      data: {
        user: {
          id: 'u1',
          email: 'a@test.local',
          status: 'ACTIVE',
          emailVerified: true,
        },
        accessToken: 'access-2',
        expiresInSeconds: 900,
      },
    });

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
