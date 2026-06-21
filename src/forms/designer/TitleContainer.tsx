// The form's title as a canvas widget. Like the submit button it reuses the
// container chrome, selection, and interact.js drag/resize wiring, but it has no
// delete control (it can't be removed) and renders the form title text with its
// configured typography. Its placement + style live on schema.titleBox (keyed by
// TITLE_NAME); the text itself is schema.title.

import { memo, useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import type { FormTitle, LayoutBox } from "../types";
import { titleTextStyle } from "../titleStyle";
import { TITLE_NAME, useDesignerStoreApi } from "./designerStore";
import { useInteractable } from "./useInteractable";

const HANDLES = ["n", "e", "s", "w", "ne", "nw", "se", "sw"] as const;

type TitleContainerProps = {
  layout: LayoutBox;
  // The resolved title text for the active locale ("" when the form is untitled).
  title: string;
  // The title's typography (size / family / weight / style / color).
  style: FormTitle | undefined;
  locale: string;
  selected: boolean;
  primary: boolean;
};

function TitleContainerImpl({
  layout,
  title,
  style,
  locale,
  selected,
  primary,
}: TitleContainerProps) {
  const { t, i18n } = useTranslation("form");
  const store = useDesignerStoreApi();
  const ref = useRef<HTMLDivElement>(null);
  useInteractable(ref, TITLE_NAME);

  const text = title || t("designer.title.placeholder");

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const st = store.getState();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      st.toggleSelect(TITLE_NAME);
    } else if (!st.selection.includes(TITLE_NAME)) {
      st.select(TITLE_NAME);
    }
  };

  return (
    <div
      ref={ref}
      className={`dz-lc is-title${selected ? " is-selected" : ""}${
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
        <div
          className={`dz-title-preview${title ? "" : " is-placeholder"}`}
          style={titleTextStyle(style)}
        >
          {text}
        </div>
      </div>

      <span className="dz-lc-badge" aria-hidden="true">
        {t("designer.title.title")}
      </span>

      {selected &&
        HANDLES.map((h) => (
          <span key={h} className={`dz-lc-handle dz-lc-handle-${h}`} aria-hidden="true" />
        ))}
    </div>
  );
}

export const TitleContainer = memo(TitleContainerImpl);
