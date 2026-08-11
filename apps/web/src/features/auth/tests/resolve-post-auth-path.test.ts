import { describe, expect, it } from 'vitest';

import { resolvePostAuthPath } from '@/features/auth/lib/resolve-post-auth-path';

describe('resolvePostAuthPath', () => {
  it('retourne / par défaut', () => {
    expect(resolvePostAuthPath(undefined)).toBe('/');
    expect(resolvePostAuthPath(null)).toBe('/');
    expect(resolvePostAuthPath({})).toBe('/');
  });

  it('restaure la route d’origine', () => {
    expect(
      resolvePostAuthPath({
        from: { pathname: '/planning', search: '?x=1', hash: '#top' },
      }),
    ).toBe('/planning?x=1#top');
  });

  it('évite les boucles vers les pages auth publiques', () => {
    expect(resolvePostAuthPath({ from: { pathname: '/login' } })).toBe('/');
    expect(resolvePostAuthPath({ from: { pathname: '/register' } })).toBe('/');
  });
});
