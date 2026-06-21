// The runtime: renders a FormSchema as a fillable form. Owns answer state,
// evaluates conditional visibility, validates on submit, and applies the theme
// as CSS variables. Used by the designer's Preview tab now and by real
// end-user form filling later. No third-party form library.

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import type { FormField, FormSchema, FormValues, LayoutBox } from "./types";
import { getFieldType } from "./fieldTypes";
import { resolveText } from "./text";
import { titleTextStyle } from "./titleStyle";
import { cssDim } from "./units";
import { breakpointForWidth, resolveLayout } from "./responsive";
import { evaluateExpression } from "./conditions";
import { isFieldRequired, validateForm, type ValidationErrors } from "./validation";
import { themeToCssVars } from "./theme";
import { colSpanToVars } from "./layout";
import { fieldsInBox } from "./designer/canvasLayout";

// Display fields that fill their designed box instead of sizing to content: the
// image and preset-signature (media kept via object-fit) and the table (which
// scrolls inside the box — `.ff-table-wrap` is height:100% + overflow:auto, so a
// long table stays within its box rather than overflowing onto the fields and
// submit below it). In absolute layout the container takes the designed box
// height so it behaves the same way it does on the design canvas; in flow mode
// the height stays auto so the content flows naturally and the table grows.
const FILLS_BOX = new Set<string>(["image", "signature", "table"]);

type FormRendererProps = {
  schema: FormSchema;
  locale: string;
  onSubmit?: (values: FormValues) => void;
  // In-scope variables for dynamic-text `{name}` interpolation: process globals
  // plus answers produced by upstream forms. The form's own (live) answers are
  // merged on top, so a same-named field reflects what's typed here. Optional —
  // when absent, dynamic text only resolves against this form's own answers.
  variables?: Record<string, unknown>;
  // Scale the absolute layout to fill the container's width (used by the Preview,
  // so the design stretches to 100% instead of sitting at its fixed width with
  // gutters). The design's proportions are preserved — it's scaled uniformly.
  fitWidth?: boolean;
};

export default function FormRenderer({
  schema,
  locale,
  onSubmit,
  variables,
  fitWidth,
}: FormRendererProps) {
  const { t } = useTranslation("form");
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [completed, setCompleted] = useState(false);
  // Which collapsible group sections the end user has collapsed (by group name).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (name: string) =>
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));

  // Available width drives the layout mode: the form honors the designed
  // absolute positions when there's room for its full canvas width, and falls
  // back to a responsive vertical flow on narrower screens (mobile).
  const rootRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(Infinity);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // The space available to the fields is the form's CONTENT box (inside its
    // padding) — what the absolute stage actually fills and what its breakpoint
    // is measured against. The ResizeObserver reports exactly that via
    // contentRect; the initial read subtracts the computed padding to match.
    const measure = () => {
      const cs = getComputedStyle(el);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      setAvailable(Math.max(0, el.clientWidth - (Number.isFinite(pad) ? pad : 0)));
    };
    measure();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setAvailable(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fields = useMemo(
    () => schema.pages.flatMap((page) => page.elements),
    [schema],
  );
  const themeStyle = useMemo(() => themeToCssVars(schema.theme), [schema.theme]);

  // The responsive breakpoint the available width falls into, and every field's
  // layout resolved for it (the base layout, or the nearest override that
  // cascades to it — see responsive.ts). `projected` carries those resolved
  // boxes so the rest of the renderer works in one coordinate space.
  const bp = useMemo(
    () => breakpointForWidth(available === Infinity ? 100000 : available),
    [available],
  );
  const projected = useMemo(
    () => fields.map((f) => ({ ...f, layout: resolveLayout(f, bp) })),
    [fields, bp],
  );
  const submitLayout = resolveLayout(schema.submit, bp);
  const titleLayout = resolveLayout(schema.titleBox, bp);

  // Fields hidden because they sit inside a section the user has collapsed. The
  // section's members are those whose centre falls within its box (spatial
  // containment), matching how the designer moves a section with its contents.
  const hiddenInCollapsed = useMemo(() => {
    const hidden = new Set<string>();
    for (const f of projected) {
      if (f.type === "group" && f.layout && collapsed[f.name]) {
        for (const m of fieldsInBox(projected, f.layout, f.name)) hidden.add(m);
      }
    }
    return hidden;
  }, [projected, collapsed]);

  const everyPlaced = projected.length > 0 && projected.every((f) => f.layout);
  const rightEdge = (l?: LayoutBox) => (l ? l.x + l.width : 0);
  // The width the resolved layout occupies. The form honors absolute placement
  // when every field has a (resolved) box and the container is at least that
  // wide; otherwise it falls back to the responsive vertical flow (e.g. a mobile
  // width with no small-screen layout designed).
  const contentWidth = Math.max(
    0,
    ...projected.map((f) => rightEdge(f.layout)),
    rightEdge(submitLayout),
    rightEdge(titleLayout),
  );
  const absolute = everyPlaced && contentWidth > 0 && available >= contentWidth;
  // The form's optional max width (px). The absolute design is stretched
  // horizontally to fill its container up to this cap.
  const maxWidth = schema.canvas?.maxWidth;
  // The width the absolute form occupies. In Preview's fit mode it fills the
  // container (capped at maxWidth); at runtime it fills up to maxWidth when one
  // is set, otherwise it keeps the design width — so forms without a max width
  // render unchanged. The design is then stretched horizontally to this width so
  // a full-width field fills the form rather than sitting at the design width.
  const fillTarget =
    !absolute || available === Infinity
      ? contentWidth
      : fitWidth
        ? Math.min(available, maxWidth ?? available)
        : maxWidth
          ? Math.min(available, maxWidth)
          : contentWidth;
  // Horizontal stretch factor and the resulting stage width. Only width and x are
  // scaled (height/vertical positions and font sizes stay), so the form widens
  // without distorting text.
  const fitK = contentWidth > 0 ? fillTarget / contentWidth : 1;
  const stageWidth = Math.round(contentWidth * fitK);
  // Map a design-space x to the stretched stage, and a layout's width to a CSS
  // length scaled to it.
  const sx = (v: number) => Math.round(v * fitK);
  const wcss = (l: LayoutBox) => cssDim(l.width * fitK, l.widthUnit, stageWidth);
  // In flow mode, order by the visual top-to-bottom (then start-to-end) layout
  // so the stacked order matches what the designer arranged.
  const flowOrder = useMemo(() => {
    if (!everyPlaced) return projected;
    return [...projected].sort(
      (a, b) => a.layout!.y - b.layout!.y || a.layout!.x - b.layout!.x,
    );
  }, [projected, everyPlaced]);
  const stageHeight = useMemo(() => {
    const fieldsBottom = projected.reduce(
      (max, f) => (f.layout ? Math.max(max, f.layout.y + f.layout.height) : max),
      0,
    );
    const submitBottom = submitLayout
      ? submitLayout.y + submitLayout.height
      : 0;
    const titleBottom = titleLayout ? titleLayout.y + titleLayout.height : 0;
    return Math.max(fieldsBottom, submitBottom, titleBottom) + 24;
  }, [projected, submitLayout, titleLayout]);

  const setValue = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = () => {
    const found = validateForm(fields, values);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setCompleted(true);
      onSubmit?.(values);
    }
  };

  if (completed) {
    return (
      <div className="ff-root ff-complete" style={themeStyle}>
        <div className="ff-complete-card">
          <h3>{t("designer.preview.completedTitle")}</h3>
          <button
            type="button"
            className="ff-btn ff-btn-ghost"
            onClick={() => {
              setCompleted(false);
              setValues({});
              setErrors({});
            }}
          >
            {t("designer.preview.again")}
          </button>
        </div>
      </div>
    );
  }

  const title = resolveText(schema.title, locale);
  const description = resolveText(schema.description, locale);
  const titleStyle = titleTextStyle(schema.titleBox);
  // In absolute (desktop) mode the title sits at its designed box inside the
  // stage; otherwise it stays in the header at the top of the form.
  const titleInStage = absolute && !!titleLayout && !!title;

  // The variable scope for dynamic-text interpolation: external (process /
  // upstream-form) variables with this form's own live answers layered on top.
  const scope: Record<string, unknown> = { ...(variables ?? {}), ...values };

  // The label + control + error for a field, shared by both layout modes.
  const fieldInner = (field: FormField): ReactNode => {
    const def = getFieldType(field.type);
    if (!def) return null;
    const fieldId = `ff-${field.name}`;
    const control = def.Render({
      field,
      value: values[field.name],
      onChange: (v) => setValue(field.name, v),
      locale,
      id: fieldId,
      scope,
    });
    if (def.group === "display") return control;
    const label = resolveText(field.title, locale) || field.name;
    const fieldDesc = resolveText(field.description, locale);
    const required = isFieldRequired(field, values);
    const error = errors[field.name];
    return (
      <>
        <label className="ff-label" htmlFor={fieldId}>
          {label}
          {required && <span className="ff-required" aria-hidden="true"> *</span>}
        </label>
        {fieldDesc && <p className="ff-field-desc">{fieldDesc}</p>}
        {control}
        {error && <p className="ff-error">{t(`designer.errors.${error}`)}</p>}
      </>
    );
  };

  const renderOrder = absolute ? projected : flowOrder;

  return (
    <div ref={rootRef} className="ff-root" style={themeStyle}>
      {((title && !titleInStage) || description) && (
        <header className="ff-header">
          {title && !titleInStage && (
            <h2 className="ff-title" style={titleStyle}>
              {title}
            </h2>
          )}
          {description && <p className="ff-desc">{description}</p>}
        </header>
      )}

      <div
        className={`ff-fields${absolute ? " ff-fields-absolute" : ""}`}
        style={
          absolute
            ? {
                position: "relative",
                width: stageWidth,
                height: stageHeight,
                maxWidth: "100%",
                marginInline: "auto",
              }
            : undefined
        }
      >
        {renderOrder.map((field) => {
          // Skip fields tucked inside a collapsed section.
          if (hiddenInCollapsed.has(field.name)) return null;
          if (field.visibleIf && !evaluateExpression(field.visibleIf, values)) {
            return null;
          }
          const def = getFieldType(field.type);
          if (!def) return null;

          // A section box: a titled (optionally collapsible) container drawn
          // behind the fields placed within it.
          if (field.type === "group" && field.layout && absolute) {
            return (
              <GroupSection
                key={field.name}
                field={field}
                locale={locale}
                collapsed={!!collapsed[field.name]}
                left={sx(field.layout.x)}
                widthCss={wcss(field.layout)}
                onToggle={() => toggleGroup(field.name)}
              />
            );
          }

          const isDisplay = def.group === "display";
          const error = errors[field.name];
          const className = `ff-field${isDisplay ? " ff-field-display" : ""}${
            error ? " has-error" : ""
          }`;

          if (absolute && field.layout) {
            return (
              <div
                key={field.name}
                className={className}
                style={{
                  position: "absolute",
                  insetInlineStart: sx(field.layout.x),
                  top: field.layout.y,
                  width: wcss(field.layout),
                  // Media display fields fill their designed box height; other
                  // fields keep their natural (content-driven) height.
                  ...(FILLS_BOX.has(field.type)
                    ? { height: field.layout.height }
                    : null),
                }}
              >
                {fieldInner(field)}
              </div>
            );
          }

          return (
            <div
              key={field.name}
              className={className}
              style={colSpanToVars(field.colSpan)}
            >
              {fieldInner(field)}
            </div>
          );
        })}
        {titleInStage && titleLayout && (
          <h2
            className="ff-title ff-title-abs"
            style={{
              position: "absolute",
              insetInlineStart: sx(titleLayout.x),
              top: titleLayout.y,
              width: wcss(titleLayout),
              zIndex: titleLayout.zIndex,
              margin: 0,
              ...titleStyle,
            }}
          >
            {title}
          </h2>
        )}
        {absolute && submitLayout && (
          <button
            type="button"
            className="ff-btn ff-btn-primary ff-submit-abs"
            onClick={handleSubmit}
            style={{
              position: "absolute",
              insetInlineStart: sx(submitLayout.x),
              top: submitLayout.y,
              width: wcss(submitLayout),
              height: submitLayout.height,
            }}
          >
            {resolveText(schema.submit?.label, locale) ||
              t("designer.preview.submit")}
          </button>
        )}
      </div>

      {/* Fall back to a normal action bar whenever the submit isn't placed
          absolutely (flow mode, or a schema with no submit layout). */}
      {!(absolute && submitLayout) && (
        <div className="ff-actions">
          <button
            type="button"
            className="ff-btn ff-btn-primary"
            onClick={handleSubmit}
          >
            {t("designer.preview.submit")}
          </button>
        </div>
      )}
    </div>
  );
}

// A section box at runtime: a titled, bordered container positioned behind the
// fields placed within it (so they render on top). When the field is
// `collapsible`, the header is a button that collapses the section — the fields
// inside it are then hidden (see `hiddenInCollapsed`) and the box shrinks to its
// header.
function GroupSection({
  field,
  locale,
  collapsed,
  left,
  widthCss,
  onToggle,
}: {
  field: FormField;
  locale: string;
  collapsed: boolean;
  // The section's stretched x and width (mapped to the stage by the renderer).
  left: number;
  widthCss: string;
  onToggle: () => void;
}) {
  const layout = field.layout!;
  // An empty title hides the header — unless the section is collapsible, which
  // still needs it for the expand/collapse toggle.
  const title = resolveText(field.title, locale);
  const showHead = title.trim() !== "" || Boolean(field.collapsible);
  const HEAD_HEIGHT = 40;
  const head = (
    <>
      {field.collapsible && (
        <span className="ff-group-caret" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
      )}
      {title && <span className="ff-group-title">{title}</span>}
    </>
  );
  return (
    <div
      className="ff-field ff-field-display ff-group-field"
      style={{
        position: "absolute",
        insetInlineStart: left,
        top: layout.y,
        width: widthCss,
        height: collapsed ? HEAD_HEIGHT : layout.height,
        zIndex: layout.zIndex,
      }}
    >
      <div
        className={`ff-group${field.collapsible ? " is-collapsible" : ""}${
          collapsed ? " is-collapsed" : ""
        }`}
      >
        {showHead &&
          (field.collapsible ? (
            <button
              type="button"
              className="ff-group-head"
              onClick={onToggle}
              aria-expanded={!collapsed}
            >
              {head}
            </button>
          ) : (
            <div className="ff-group-head">{head}</div>
          ))}
      </div>
    </div>
  );
}
