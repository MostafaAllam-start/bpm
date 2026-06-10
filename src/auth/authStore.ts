import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  userName: string;
  // The login response shape isn't documented in swagger, so we keep whatever
  // profile-ish payload came back alongside the token for later use.
  raw?: unknown;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: () => boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: () => Boolean(get().token),
      signIn: (token, user) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    {
      name: "ecmplus-auth",
      // Only persist the durable bits; the helpers are recreated on load.
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);

/** Read the current token outside React (e.g. from the API client). */
export const getToken = () => useAuthStore.getState().token;

/**
 * Clear auth outside React (e.g. after a 401 from the API client). Clearing the
 * token makes the RequireAuth gate redirect to /login on its next render.
 */
export const clearAuth = () => useAuthStore.getState().signOut();
