type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

const AUTH_PUBLIC_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]);

/** Destination après login/register, ou `/` par défaut. */
export function resolvePostAuthPath(state: unknown): string {
  const from = (state as LocationState | null)?.from;
  if (!from?.pathname) {
    return '/';
  }
  if (AUTH_PUBLIC_PATHS.has(from.pathname)) {
    return '/';
  }
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}
