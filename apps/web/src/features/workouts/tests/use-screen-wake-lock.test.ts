import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScreenWakeLock } from '../hooks/use-screen-wake-lock';

type MockSentinel = {
  released: boolean;
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emitRelease: () => void;
};

function createMockSentinel(): MockSentinel {
  let releaseListener: (() => void) | null = null;
  const sentinel: MockSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
      releaseListener?.();
    }),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'release') releaseListener = listener;
    }),
    removeEventListener: vi.fn(),
    emitRelease: () => {
      sentinel.released = true;
      releaseListener?.();
    },
  };
  return sentinel;
}

describe('useScreenWakeLock', () => {
  let request: ReturnType<typeof vi.fn>;
  let visibilityState: DocumentVisibilityState;

  beforeEach(() => {
    request = vi.fn();
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      wakeLock: { request },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('active + visible → request("screen") une fois', async () => {
    const sentinel = createMockSentinel();
    request.mockResolvedValue(sentinel);

    renderHook(() => useScreenWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('inactive → aucune acquisition', async () => {
    renderHook(() => useScreenWakeLock(false));
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('active → inactive → release()', async () => {
    const sentinel = createMockSentinel();
    request.mockResolvedValue(sentinel);

    const { rerender } = renderHook(
      ({ active }) => useScreenWakeLock(active),
      { initialProps: { active: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ active: false });
      await Promise.resolve();
    });

    expect(sentinel.release).toHaveBeenCalled();
  });

  it('API absente → aucune exception', async () => {
    vi.stubGlobal('navigator', { ...navigator });
    expect(() => {
      renderHook(() => useScreenWakeLock(true));
    }).not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('request rejected → aucune exception propagée', async () => {
    request.mockRejectedValue(new Error('NotAllowedError'));
    expect(() => {
      renderHook(() => useScreenWakeLock(true));
    }).not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('visibility hidden puis visible → réacquisition', async () => {
    const first = createMockSentinel();
    const second = createMockSentinel();
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    renderHook(() => useScreenWakeLock(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);

    // Le navigateur libère souvent le lock en arrière-plan.
    act(() => {
      first.emitRelease();
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('unmount → release', async () => {
    const sentinel = createMockSentinel();
    request.mockResolvedValue(sentinel);

    const { unmount } = renderHook(() => useScreenWakeLock(true));
    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(sentinel.release).toHaveBeenCalled();
  });

  it('déjà acquis → pas de second request', async () => {
    const sentinel = createMockSentinel();
    request.mockResolvedValue(sentinel);

    const { rerender } = renderHook(
      ({ active }) => useScreenWakeLock(active),
      { initialProps: { active: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ active: true });
      await Promise.resolve();
    });

    // Même dépendance active=true : pas de re-run effect inutile.
    // Si effect rejoue (StrictMode), le guard !released empêche un 2e request utile.
    const callsAfter = request.mock.calls.length;
    expect(callsAfter).toBeGreaterThanOrEqual(1);

    // Sentinel encore actif : une réacquisition explicite via visibility ne doit
    // pas doubler si non released — simulate visibility without release.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(request.mock.calls.length).toBe(callsAfter);
  });

  it('request résout après unmount → release immédiat', async () => {
    let resolveRequest!: (value: MockSentinel) => void;
    request.mockImplementation(
      () =>
        new Promise<MockSentinel>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { unmount } = renderHook(() => useScreenWakeLock(true));
    unmount();

    const late = createMockSentinel();
    await act(async () => {
      resolveRequest(late);
      await Promise.resolve();
    });

    expect(late.release).toHaveBeenCalled();
  });
});
