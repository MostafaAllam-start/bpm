// A single field rendered as a movable / resizable widget on the canvas, over the
// shared CanvasWidget chrome. The body shows a real (but inert) preview of the
// control via the field-type registry, so the canvas is WYSIWYG.
//
// When any field is selected a floating actions bar appears above it: EN/AR locale
// toggle (switches which locale is previewed/edited) and a trash button to delete
// the field. Display fields (heading, dynamictext, html) additionally support
// in-place rich-text editing: a single click enters edit mode and places the
// cursor at the click point so click-drag immediately selects text.

import { memo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { FormField, LayoutBox } from "../types";
import type { VariableRef } from "@shared/variables.ts";
import { getFieldType } from "../utils/fieldTypes";
import { resolveText, setLocaleText, getLocaleText } from "../utils/text";
import { useDesignerStoreApi } from "./designerStore";
import { useDesignerMode } from "./DesignerModeContext";
import CanvasWidget from "./CanvasWidget";
import InlineEditor from "./InlineEditor";
import TableInlineEditor from "./TableInlineEditor";
import { TrashIcon } from "@components/icons/TrashIcon.tsx";

// Field types that are editable in-place via the rich-text InlineEditor. The
// table is handled separately (TableInlineEditor, shown whenever the table is the
// primary selection) — it has its own cell select / edit gestures.
const INLINE_EDITABLE = new Set(["heading", "dynamictext", "html"]);

type LayoutContainerProps = {
  field: FormField;
  // The layout resolved for the canvas's active breakpoint (base or an override).
  layout: LayoutBox;
  locale: string;
  selected: boolean;
  primary: boolean;
  variables?: VariableRef[];
  // Inline-editing state.
  editing?: boolean;
  onStartEdit?: () => void;
  onCommitEdit?: (value: string) => void;
};

function LayoutContainerImpl({
  field,
  layout,
  locale,
  selected,
  primary,
  variables,
  editing,
  onStartEdit,
  onCommitEdit,
}: LayoutContainerProps) {
  const { t, i18n } = useTranslation("form");
  const store = useDesignerStoreApi();
  const mode = useDesignerMode();
  const isDocMode = mode === "email" || mode === "pdf";

  const def = getFieldType(field.type);
  if (!def) return null;

  const isDisplay = def.group === "display";
  const title = !isDisplay && (resolveText(field.title, locale) || field.name);

  // Which locale's text is currently shown / edited for this field.
  // Initialises from the global locale; the user can toggle it per field.
  const [editingLocale, setEditingLocale] = useState(locale);

  // Follow global locale changes (e.g. the user switches the app language).
  useEffect(() => {
    setEditingLocale(locale);
  }, [locale]);

  // All display text fields support inline editing in every canvas mode.
  const canInlineEdit = INLINE_EDITABLE.has(field.type);

  // Stores the client coordinates of the click that triggered edit mode so the
  // InlineEditor can position the cursor at that point.
  const editStartPointRef = useRef<{ x: number; y: number } | null>(null);

  // CSS that mirrors the heading element's field-level wrapper styling (font size,
  // family, weight, colour, alignment). These properties are set via the property
  // panel and live on the field object — NOT inside the rich-text HTML — so the
  // InlineEditor must receive them explicitly to match the preview's appearance.
  // html / dynamictext carry no equivalent outer styles, so they get nothing here.
  //
  // The preview renders a real <h1>–<h6> tag (see the heading field type), so it
  // inherits the browser's default heading size and bold weight. The editor is a
  // plain <div>, so when no explicit size/weight is configured we seed those
  // defaults — otherwise edit mode would drop to plain body text and not match.
  const getEditorBaseStyle = (): React.CSSProperties => {
    if (field.type !== "heading") return {};
    const s: React.CSSProperties = {};
    const level = field.headingLevel ?? "h2";
    const HEADING_DEFAULT_SIZE: Record<string, string> = {
      h1: "2em",
      h2: "1.5em",
      h3: "1.17em",
      h4: "1em",
      h5: "0.83em",
      h6: "0.67em",
    };
    s.fontSize = field.headingFontSize
      ? `${field.headingFontSize}px`
      : HEADING_DEFAULT_SIZE[level];
    s.fontWeight = field.headingFontWeight ?? "bold";
    if (field.headingFontFamily) s.fontFamily = field.headingFontFamily;
    if (field.headingFontStyle) s.fontStyle = field.headingFontStyle;
    if (field.headingTextColor) s.color = field.headingTextColor;
    if (field.headingTextAlign) s.textAlign = field.headingTextAlign;
    return s;
  };

  // Derive the stored HTML for the active editing locale.
  // Uses getLocaleText (no fallback) so the editor starts with the exact stored
  // value — empty if no translation exists yet, letting the author fill it in.
  const getEditableHtml = (): string => {
    if (field.type === "heading") return getLocaleText(field.title, editingLocale);
    if (field.type === "dynamictext") return getLocaleText(field.text, editingLocale);
    if (field.type === "html") return getLocaleText(field.html, editingLocale);
    return "";
  };

  // Commit edited HTML back to the correct field property.
  const commitInlineEdit = (html: string) => {
    const trimmed = html.trim();
    const primaryLang = i18n.language;
    if (field.type === "heading") {
      store.getState().updateField(field.name, {
        title: setLocaleText(field.title, editingLocale, trimmed, primaryLang),
      });
    } else if (field.type === "dynamictext") {
      store.getState().updateField(field.name, {
        text: setLocaleText(field.text, editingLocale, trimmed, primaryLang),
      });
    } else if (field.type === "html") {
      store.getState().updateField(field.name, {
        html: setLocaleText(field.html, editingLocale, trimmed, primaryLang),
      });
    }
    onCommitEdit?.(trimmed);
  };

  // Single click enters edit mode; record the click point so the cursor is
  // positioned there (not at the end) enabling immediate click-drag selection.
  const handleClick =
    canInlineEdit && !editing
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          editStartPointRef.current = { x: e.clientX, y: e.clientY };
          onStartEdit?.();
        }
      : undefined;

  // ── Field actions bar (above the widget when any field is selected) ──────
  // EN/AR locale toggle + trash delete. Shown for all field types.
  const fieldActionsBar = selected ? (
    <div className="dz-lc-lang-toggle dz-lc-nodrag">
      <button
        type="button"
        className={`dz-lc-lang-btn${editingLocale.startsWith("en") ? " is-active" : ""}`}
        title="Preview / edit English"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setEditingLocale("en");
        }}
      >
        EN
      </button>
      <button
        type="button"
        className={`dz-lc-lang-btn${editingLocale.startsWith("ar") ? " is-active" : ""}`}
        title="Preview / edit Arabic"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setEditingLocale("ar");
        }}
      >
        AR
      </button>
      <span className="dz-lc-lang-sep" aria-hidden="true" />
      <button
        type="button"
        className="dz-lc-lang-del"
        aria-label={t("designer.deleteField")}
        title={t("designer.deleteField")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          store.getState().removeField(field.name);
        }}
      >
        <TrashIcon />
      </button>
    </div>
  ) : null;

  // When a field is selected, preview it in editingLocale so the author sees
  // the text they are about to edit.
  const previewLocale = selected ? editingLocale : locale;

  // A table set to auto-height drives its own box height from content, so the
  // widget renders auto (and hides the vertical resize handles) regardless of the
  // stored height. Only the rendered layout is overridden — the stored layout is
  // untouched, so toggling auto-height off restores the designed height.
  const widgetLayout =
    field.type === "table" && field.tableAutoHeight
      ? { ...layout, autoHeight: true }
      : layout;

  return (
    <CanvasWidget
      name={field.name}
      layout={widgetLayout}
      locale={locale}
      selected={selected}
      primary={primary}
      modifier={`${isDisplay ? "is-display" : ""}${editing ? " is-editing" : ""}`}
      fieldType={field.type}
      ariaLabel={title || def.type}
      badge={
        <>
          <span className="dz-lc-badge-icon">{def.icon}</span>
          {t(`designer.types.${def.labelKey}`)}
        </>
      }
      extra={fieldActionsBar}
      onClick={handleClick}
    >
      {title && (
        <div className="dz-lc-head">
          <span className="dz-lc-title">{title}</span>
          {field.isRequired && <span className="dz-lc-required"> *</span>}
        </div>
      )}
      <div
        className="dz-lc-control ff-root"
      >
        {field.type === "table" && primary ? (
          <TableInlineEditor
            field={field}
            editingLocale={editingLocale}
            primaryLang={i18n.language}
          />
        ) : editing && canInlineEdit ? (
          <InlineEditor
            key={editingLocale}
            initialHtml={getEditableHtml()}
            onCommit={commitInlineEdit}
            onCancel={() => onCommitEdit?.(getEditableHtml())}
            initialPoint={editStartPointRef.current ?? undefined}
            dir={editingLocale.startsWith("ar") ? "rtl" : "ltr"}
            style={{ width: "100%", height: "100%", minHeight: 32, ...getEditorBaseStyle() }}
          />
        ) : (
          def.Render({
            field,
            value: undefined,
            onChange: () => {},
            locale: previewLocale,
            id: `dz-preview-${field.name}`,
            disabled: true,
            variables,
            docMode: isDocMode,
          })
        )}
      </div>
    </CanvasWidget>
  );
}

// Memoized: the canvas re-renders on every drag tick, but a container only needs
// to re-render when its own field, selection flags, or locale change.
export const LayoutContainer = memo(LayoutContainerImpl);
