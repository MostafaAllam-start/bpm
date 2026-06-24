import { create } from "zustand";

// A tiny transient-notification queue, separate from the persistent render-error
// banner (ErrorBanner). The modeler hook has no UI of its own, so it raises a
// toast imperatively via `useToastStore.getState().show(...)`; the <Toaster />
// component subscribes and renders the queue. Messages are i18n keys (in the
// `bpmn` namespace) translated at render time, so toasts follow the app language.

export type ToastKind = "error" | "warning" | "info";

export type Toast = {
  id: number;
  // i18n key under the `bpmn` namespace (e.g. "toast.singletonEvent").
  messageKey: string;
  kind: ToastKind;
  params?: Record<string, string | number>;
};

type ToastState = {
  toasts: Toast[];
  show: (messageKey: string, kind?: ToastKind, params?: Record<string, string | number>) => number;
  dismiss: (id: number) => void;
};

// Each toast lingers this long before it auto-dismisses.
const AUTO_DISMISS_MS = 4000;

// Module-scope counter for stable ids (avoids Date.now()/Math.random()).
let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (messageKey, kind = "info", params) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, messageKey, kind, params }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
