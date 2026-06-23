import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A single modal primitive shared by every dialog in the app. It centralizes the
// behavior the hand-rolled modals were each missing — portal to <body>, Escape to
// close, focus trap + restore, scroll lock, and dialog ARIA — while adding NO
// visual styling: each call site passes its existing CSS class hooks
// (`backdropClassName`/`className`) so the look is unchanged.
//
// `full` appends `fullClassName` (default "is-full") for the App form modal's
// maximize toggle. Escape/backdrop close are opt-out per prop for sites that must
// not lose in-progress work (e.g. the form-designer modal sets closeOnEscape
// false so typing Escape never discards an unsaved form).

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  // The EXISTING class hooks, so per-site CSS is untouched. Backdrop wraps content.
  backdropClassName: string;
  className: string;
  // Maximize: when `full`, append the site's full-screen modifier class.
  full?: boolean;
  fullClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  // For aria-labelledby (id of a heading inside) or a literal label.
  labelledBy?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export default function Modal({
  open,
  onClose,
  backdropClassName,
  className,
  full,
  fullClassName = "is-full",
  closeOnBackdrop = true,
  closeOnEscape = true,
  labelledBy,
  ariaLabel,
  children,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  // Keep onClose in a ref so the focus/scroll effect doesn't re-run (and steal
  // focus) every render when the parent passes a fresh inline onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = modalRef.current;
    const initial = node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (closeOnEscape && event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div
      className={backdropClassName}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`${className}${full ? ` ${fullClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
