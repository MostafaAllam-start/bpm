// A single field rendered as a movable / resizable widget on the canvas, over the
// shared CanvasWidget chrome. The body shows a real (but inert) preview of the
// control via the field-type registry, so the canvas is WYSIWYG. Unlike the
// submit/title widgets it carries a delete control (passed as CanvasWidget's
// `extra` overlay).

import { memo } from "react";
import { useTranslation } from "react-i18next";

import type { FormField, LayoutBox } from "../types";
import { getFieldType } from "../utils/fieldTypes";
import { resolveText } from "../utils/text";
import { useDesignerStoreApi } from "./designerStore";
import CanvasWidget from "./CanvasWidget";

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

  const def = getFieldType(field.type);
  if (!def) return null;

  const isDisplay = def.group === "display";
  // The canvas is pinned LTR, so the delete button (normally top-right) is moved
  // to the top-left for RTL forms via a modifier class.
  const isRtl = i18n.dir(locale) === "rtl";
  const title = !isDisplay && (resolveText(field.title, locale) || field.name);

  const deleteButton = (
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
  );

  return (
    <CanvasWidget
      name={field.name}
      layout={layout}
      locale={locale}
      selected={selected}
      primary={primary}
      modifier={isDisplay ? "is-display" : undefined}
      fieldType={field.type}
      ariaLabel={title || def.type}
      badge={
        <>
          <span className="dz-lc-badge-icon">{def.icon}</span>
          {t(`designer.types.${def.labelKey}`)}
        </>
      }
      extra={deleteButton}
    >
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
    </CanvasWidget>
  );
}

// Memoized: the canvas re-renders on every drag tick, but a container only needs
// to re-render when its own field, selection flags, or locale change.
export const LayoutContainer = memo(LayoutContainerImpl);
