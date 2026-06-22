// A single field rendered as a movable / resizable widget on the canvas. The
// body shows a real (but inert) preview of the control via the field-type
// registry, so the canvas is WYSIWYG; pointer events on the body are disabled so
// drags and selection always land on the container. Selection happens on
// pointer-down (so a subsequent drag moves the right set), and interact.js wires
// the actual drag/resize through useInteractable.

import { memo, useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import type { FormField, LayoutBox } from "../types";
import { getFieldType } from "../fieldTypes";
import { resolveText } from "../text";
import { useDesignerStoreApi } from "./designerStore";
import { useInteractable } from "./useInteractable";

// The eight selection / resize affordances (visual only — interact.js detects
// the edges by pointer margin, so these never need their own pointer logic).
const HANDLES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"] as const;

type LayoutContainerProps = {
  field: FormField;
  // The layout resolved for the canvas's active breakpoint (base or an override).
  layout: LayoutBox;
  locale: string;
  selected: boolean;
  primary: boolean;
};

function LayoutContainerImpl({
  field,
  layout,
  locale,
  selected,
  primary,
}: LayoutContainerProps) {
  const { t, i18n } = useTranslation("form");
  const store = useDesignerStoreApi();
  const ref = useRef<HTMLDivElement>(null);
  useInteractable(ref, field.name);

  const def = getFieldType(field.type);
  if (!def) return null;

  const isDisplay = def.group === "display";
  // The canvas is pinned LTR, so the delete button (normally top-right) is moved
  // to the top-left for RTL forms via a modifier class.
  const isRtl = i18n.dir(locale) === "rtl";
  const title =
    !isDisplay && (resolveText(field.title, locale) || field.name);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // NOTE: do NOT stopPropagation here. interact.js delegates its pointerdown
    // listener on `document` (bubble phase), and React delegates this handler at
    // its root container *inside* <body>. Calling stopPropagation would halt the
    // native event at the React root, so it would never reach document and
    // interact would never start a drag/resize. The canvas background ignores
    // presses that land on a widget by inspecting the event target instead (see
    // CanvasRenderer.onBackgroundPointerDown), so selection here is safe without
    // stopping propagation.
    const st = store.getState();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      st.toggleSelect(field.name);
    } else if (!st.selection.includes(field.name)) {
      st.select(field.name);
    }
  };

  return (
    <div
      ref={ref}
      className={`dz-lc${selected ? " is-selected" : ""}${
        primary ? " is-primary" : ""
      }${isDisplay ? " is-display" : ""}`}
      style={{
        transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
        width: layout.width,
        height: layout.height,
        zIndex: layout.zIndex,
      }}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={-1}
      aria-label={title || def.type}
    >
      <div className="dz-lc-body" dir={i18n.dir(locale)}>
        {title && (
          <div className="dz-lc-head">
            <span className="dz-lc-title">{title}</span>
            {field.isRequired && <span className="dz-lc-required"> *</span>}
          </div>
        )}
        <div className="dz-lc-control ff-root">
          {def.Render({
            field,
            value: undefined,
            onChange: () => {},
            locale,
            id: `dz-preview-${field.name}`,
            disabled: true,
          })}
        </div>
      </div>

      <span className="dz-lc-badge" aria-hidden="true">
        <span className="dz-lc-badge-icon">{def.icon}</span>
        {t(`designer.types.${def.labelKey}`)}
      </span>

      <button
        type="button"
        className={`dz-lc-delete dz-lc-nodrag${isRtl ? " is-rtl" : ""}`}
        aria-label={t("designer.deleteField")}
        title={t("designer.deleteField")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          store.getState().removeField(field.name);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
          <path d="M6.5 6l.8 13a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-13" />
          <path d="M10 10.5v6M14 10.5v6" />
        </svg>
      </button>

      {selected &&
        HANDLES.map((h) => (
          <span key={h} className={`dz-lc-handle dz-lc-handle-${h}`} aria-hidden="true" />
        ))}
    </div>
  );
}

// Memoized: the canvas re-renders on every drag tick, but a container only needs
// to re-render when its own field, selection flags, or locale change.
export const LayoutContainer = memo(LayoutContainerImpl);
