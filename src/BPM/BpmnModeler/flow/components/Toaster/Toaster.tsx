import { useTranslation } from "react-i18next";

import { useToastStore } from "../../store/toastStore.ts";

// Renders the transient toast queue (see toastStore) as a fixed corner stack.
// Each toast translates its i18n key and carries a dismiss button; the store
// auto-removes them after a timeout. Self-gates to nothing when the queue is
// empty so it never paints an empty overlay.
export default function Toaster() {
  const { t } = useTranslation("bpmn");
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="bf-toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`bf-toast bf-toast-${toast.kind}`}>
          <span className="bf-toast-msg">{t(toast.messageKey, toast.params)}</span>
          <button
            type="button"
            className="bf-toast-close"
            title={t("toast.dismiss")}
            aria-label={t("toast.dismiss")}
            onClick={() => dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
