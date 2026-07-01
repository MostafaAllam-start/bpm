// A contentEditable overlay for in-place rich-text editing of display fields.
// Mounts focused with cursor at the original click point (caretRangeFromPoint /
// caretPositionFromPoint) so click-drag immediately selects text. Blur commits;
// Escape cancels. Carries .dz-lc-nodrag so interact.js drag-start is suppressed,
// and forces user-select: text so the parent canvas's user-select: none doesn't
// block text highlighting.

import { useEffect, useRef } from "react";

import { caretAtPoint } from "./caretFromPoint";

export type InlineEditorProps = {
  initialHtml: string;
  onCommit: (html: string) => void;
  onCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
  // Client coordinates of the click that opened edit mode. When provided the
  // cursor is placed there so click-drag immediately selects from that point.
  initialPoint?: { x: number; y: number };
};

export default function InlineEditor({
  initialHtml,
  onCommit,
  onCancel,
  className,
  style,
  initialPoint,
}: InlineEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = initialHtml;
    // Enable CSS-based inline styling (produces <span style="…"> not <font>/<b>).
    document.execCommand("styleWithCSS", false, "true");
    // Use <div> for paragraph separators so that block-alignment commands
    // (justifyCenter etc.) wrap content in an inner <div> rather than setting
    // text-align on the contentEditable element itself (which would be lost on commit).
    document.execCommand("defaultParagraphSeparator", false, "div");
    el.focus();

    // Position cursor at the original click point; fall back to end of content.
    if (initialPoint) {
      const range = caretAtPoint(initialPoint.x, initialPoint.y, el);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (e: React.FocusEvent) => {
    // Don't commit when focus moves into the floating format toolbar (e.g. the
    // font-size <select> or a colour picker). Those controls live in a portal
    // outside the editor, so interacting with them blurs the contentEditable —
    // but committing here would unmount the editor and discard the live
    // selection. The toolbar refocuses the editor and restores the range itself.
    // relatedTarget is the element receiving focus; native <select> can report it
    // as null while its dropdown is open, so fall back to document.activeElement.
    const next = (e.relatedTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    if (next?.closest?.(".tf-toolbar")) return;
    if (ref.current) onCommit(ref.current.innerHTML);
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`dz-inline-editor dz-lc-nodrag${className ? ` ${className}` : ""}`}
      style={{
        outline: "none",
        cursor: "text",
        minHeight: "1em",
        userSelect: "text",
        // Re-enable pointer events so the editor can receive clicks and
        // mouse-drag text selection. The parent .dz-lc-body has
        // pointer-events:none to keep the preview inert, but the editor
        // must receive them so the user can position the cursor and select.
        pointerEvents: "auto",
        ...style,
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        // Allow Enter for multi-line; only Escape aborts.
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
