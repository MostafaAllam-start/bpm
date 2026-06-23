// The shared chrome for every movable/resizable widget on the design canvas: the
// positioned `dz-lc` root (translate3d + size + z-index), interact.js drag/resize
// wiring, pointer-down selection, the `dz-lc-body` (with locale direction), the
// type badge, and the eight resize handles. The field / submit / title containers
// supply only what differs — body content, badge, an optional `extra` overlay
// (e.g. a delete button), the selection `name`, and a root modifier class.

import { useRef, type PointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { LayoutBox } from "../../types";
import { useDesignerStoreApi } from "../designerStore";
import { useInteractable } from "../useInteractable";

// The eight selection / resize affordances (visual only — interact.js detects the
// edges by pointer margin, so these never need their own pointer logic).
const HANDLES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"] as const;

type CanvasWidgetProps = {
  // The element key this widget selects/drags (a field name, SUBMIT_NAME, …).
  name: string;
  layout: LayoutBox;
  locale: string;
  selected: boolean;
  primary: boolean;
  // Extra root-class modifier(s): "is-submit" | "is-title" | "is-display".
  modifier?: string;
  // The field type (e.g. "text", "checkbox") — applied as data-field-type for
  // CSS min-height targeting so each type stays visible when resized small.
  fieldType?: string;
  ariaLabel: string;
  // The type badge contents (icon + label, or plain text).
  badge: ReactNode;
  // The body preview, rendered inside `dz-lc-body`.
  children: ReactNode;
  // An optional overlay rendered as a sibling of the body/badge (e.g. delete).
  extra?: ReactNode;
};

export default function CanvasWidget({
  name,
  layout,
  locale,
  selected,
  primary,
  modifier,
  fieldType,
  ariaLabel,
  badge,
  children,
  extra,
}: CanvasWidgetProps) {
  const { i18n } = useTranslation("form");
  const store = useDesignerStoreApi();
  const ref = useRef<HTMLDivElement>(null);
  useInteractable(ref, name);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // NOTE: do NOT stopPropagation here. interact.js delegates its pointerdown
    // listener on `document` (bubble phase) and React delegates this handler at
    // its root inside <body>; stopping propagation would prevent interact from
    // ever starting a drag/resize. The canvas background ignores presses landing
    // on a widget by inspecting the event target instead.
    const st = store.getState();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      st.toggleSelect(name);
    } else if (!st.selection.includes(name)) {
      st.select(name);
    }
  };

  return (
    <div
      ref={ref}
      className={`dz-lc${modifier ? ` ${modifier}` : ""}${selected ? " is-selected" : ""}${
        primary ? " is-primary" : ""
      }`}
      data-field-type={fieldType}
      style={{
        transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
        width: layout.width,
        height: layout.height,
        zIndex: layout.zIndex,
      }}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={-1}
      aria-label={ariaLabel}
    >
      <div className="dz-lc-body" dir={i18n.dir(locale)}>
        {children}
      </div>

      <span className="dz-lc-badge" aria-hidden="true">
        {badge}
      </span>

      {extra}

      {selected &&
        HANDLES.map((h) => (
          <span key={h} className={`dz-lc-handle dz-lc-handle-${h}`} aria-hidden="true" />
        ))}
    </div>
  );
}
