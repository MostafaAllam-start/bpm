// The form's submit button as a canvas widget. It reuses the same container
// chrome, selection, and interact.js drag/resize wiring as a field, but it has
// no delete control (it can't be removed) and renders a button preview instead
// of a field. Its layout lives on schema.submit (keyed by SUBMIT_NAME), not in
// page.elements.

import { memo, useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import type { LayoutBox } from "../types";
import { SUBMIT_NAME, useDesignerStoreApi } from "./designerStore";
import { useInteractable } from "./useInteractable";

const HANDLES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"] as const;

type SubmitContainerProps = {
  layout: LayoutBox;
  label?: string;
  locale: string;
  selected: boolean;
  primary: boolean;
};

function SubmitContainerImpl({
  layout,
  label,
  locale,
  selected,
  primary,
}: SubmitContainerProps) {
  const { t, i18n } = useTranslation("form");
  const store = useDesignerStoreApi();
  const ref = useRef<HTMLDivElement>(null);
  useInteractable(ref, SUBMIT_NAME);

  const text = label || t("designer.preview.submit");

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const st = store.getState();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      st.toggleSelect(SUBMIT_NAME);
    } else if (!st.selection.includes(SUBMIT_NAME)) {
      st.select(SUBMIT_NAME);
    }
  };

  return (
    <div
      ref={ref}
      className={`dz-lc is-submit${selected ? " is-selected" : ""}${
        primary ? " is-primary" : ""
      }`}
      style={{
        transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
        width: layout.width,
        height: layout.height,
        zIndex: layout.zIndex,
      }}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={-1}
      aria-label={text}
    >
      <div className="dz-lc-body" dir={i18n.dir(locale)}>
        <button type="button" className="dz-submit-btn" disabled tabIndex={-1}>
          {text}
        </button>
      </div>

      <span className="dz-lc-badge" aria-hidden="true">
        {t("designer.submit.title")}
      </span>

      {selected &&
        HANDLES.map((h) => (
          <span key={h} className={`dz-lc-handle dz-lc-handle-${h}`} aria-hidden="true" />
        ))}
    </div>
  );
}

export const SubmitContainer = memo(SubmitContainerImpl);
