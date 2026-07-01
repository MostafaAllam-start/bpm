import { create } from "zustand";

// Tracks the live "test connection" status of each API-sourced process variable,
// keyed by variable name. This is runtime state (not part of the saved diagram):
// an API variable is only considered valid once its connection has been tested
// successfully, so validation reads this store and the properties panel writes
// it. Editing a variable's API config clears its entry, dropping it back to
// "untested" so the process is invalid until the user re-tests.

export type ApiCheckStatus = "untested" | "checking" | "ok" | "error";

type ApiCheckState = {
  // Per variable-name status. An absent entry means "untested".
  status: Record<string, ApiCheckStatus>;
  setStatus: (name: string, status: ApiCheckStatus) => void;
  clear: (name: string) => void;
};

export const useApiCheckStore = create<ApiCheckState>((set) => ({
  status: {},
  setStatus: (name, status) =>
    set((s) => ({ status: { ...s.status, [name]: status } })),
  clear: (name) =>
    set((s) => {
      if (!(name in s.status)) return s;
      const next = { ...s.status };
      delete next[name];
      return { status: next };
    }),
}));
