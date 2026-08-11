import { create } from 'zustand';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

type AuthState = {
  authStatus: AuthStatus;
  accessToken: string | null;
  /** true uniquement si authStatus === 'authenticated' */
  isAuthenticated: boolean;
  setSession: (accessToken: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  authStatus: 'initializing',
  accessToken: null,
  isAuthenticated: false,
  setSession: (accessToken) =>
    set({
      accessToken,
      authStatus: 'authenticated',
      isAuthenticated: true,
    }),
  clearSession: () =>
    set({
      accessToken: null,
      authStatus: 'unauthenticated',
      isAuthenticated: false,
    }),
}));
