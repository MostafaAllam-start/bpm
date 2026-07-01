// The runtime: renders a FormSchema as a fillable form. Owns answer state,
// evaluates conditional visibility, validates on submit, and applies the theme
// as CSS variables. Used by the designer's Preview tab and by real form filling.
//
// Layout: the form mirrors the absolute design from the canvas. HORIZONTAL
// positions and widths are scaled to the available (breakpoint) width so the
// design fits the screen; VERTICAL positions and heights are kept exactly as
// designed ("y as is"). So the preview/runtime is a faithful, horizontally-scaled
// copy of what was laid out on the canvas at the active breakpoint — element
// order and arrangement match the designer. `left` is physical (matching the
// LTR-pinned canvas), so RTL forms keep the same left/right arrangement too.

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import type { FormField, FormSchema, FormValues, LayoutBox } from "./types";
import { buttonVariantClass, getFieldType } from "./utils/fieldTypes";
import { resolveText } from "./utils/text";
import { interpolate } from "./utils/interpolation";
import { titleTextStyle } from "./utils/titleStyle";
import { cssDim } from "./utils/units";
import { breakpointForWidth, resolveLayout } from "./utils/responsive";
import { evaluateExpression } from "./utils/conditions";
import { isFieldRequired, validateForm, type ValidationErrors } from "./utils/validation";
import { themeToCssVars } from "./utils/theme";
import { DEFAULT_CANVAS_WIDTH, ensureLayout, fieldsInBox } from "./designer/canvasLayout";
import { GroupSection } from "./fields/GroupSection";

// Display fields whose content fills their designed box (kept at the designed
// height): media via object-fit, the table (which scrolls inside the box), and
// list fields (which scroll inside the box when content exceeds the design height).
const FILLS_BOX = new Set<string>(["image", "signature", "table", "orderedlist", "unorderedlist"]);

type FormRendererProps = {
  schema: FormSchema;
  locale: string;
  onSubmit?: (values: FormValues) => void;
  // In-scope variables for dynamic-text `{name}` interpolation: process globals
  // plus answers produced by upstream forms. The form's own (live) answers are
  // merged on top, so a same-named field reflects what's typed here.
  variables?: Record<string, unknown>;
  // The intended screen width (px) for picking the responsive breakpoint, set by
  // the Preview tab's device selector (the form measures a few px under the device
  // frame, which would otherwise select the breakpoint below). Falls back to the
  // measured width (Auto preview / real runtime).
  previewWidth?: number;
};

export default function FormRenderer({
  schema: schemaProp,
  locale,
  onSubmit,
  variables,
  previewWidth,
}: FormRendererProps) {
  const { t, i18n } = useTranslation("form");
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [completed, setCompleted] = useState(false);
  // Which collapsible group sections the end user has collapsed (by group name).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (name: string) =>
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));

  // Backfill absolute layout for any field that lacks one (schemas saved before
  // the visual designer, or example forms defined without explicit positions).
  const schema = useMemo(() => ensureLayout(schemaProp), [schemaProp]);

  const fields = useMemo(
    () => schema.pages.flatMap((page) => page.elements),
    [schema],
  );
  const themeStyle = useMemo(() => themeToCssVars(schema.theme), [schema.theme]);

  // Measure the form's own width so we can scale the design to it and pick the
  // responsive breakpoint. In the Preview tab the form sits in a frame of the
  // chosen device width, so this is that device's width.
  const rootRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(Infinity);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setAvailable(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxWidth = schema.canvas?.maxWidth;
  const formWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;

  // The breakpoint the screen width falls into, and every element resolved at it
  // (its own per-screen override, or the base "All" design). The Preview device
  // width wins when given; otherwise the form's measured width.
  const screenWidth =
    previewWidth ?? (available === Infinity ? 100000 : available);
  const bp = useMemo(() => breakpointForWidth(screenWidth), [screenWidth]);
  const projected = useMemo(
    () => fields.map((f) => ({ ...f, layout: resolveLayout(f, bp) })),
    [fields, bp],
  );
  const submitLayout = resolveLayout(schema.submit, bp);
  const titleLayout = resolveLayout(schema.titleBox, bp);

  // Horizontal scale: fit the design width into the available (breakpoint) width,
  // capped at the form's max width and centred. Vertical positions/heights are NOT
  // scaled. `sx` scales an x or a width; `wcss` scales a layout's width to a CSS
  // length (a px width scales; a %/col width stays the same fraction of the stage).
  const targetWidth =
    available === Infinity
      ? formWidth
      : maxWidth
        ? Math.min(available, maxWidth)
        : available;
  const k = formWidth > 0 ? targetWidth / formWidth : 1;
  const stageWidth = Math.round(formWidth * k);
  const sx = (v: number) => Math.round(v * k);
  const wcss = (l: LayoutBox) => cssDim(l.width * k, l.widthUnit, stageWidth);

  // Fields hidden because they sit inside a collapsed section (its box shrinks to
  // the header). Membership is spatial — the field's centre falls in the box.
  const hiddenInCollapsed = useMemo(() => {
    const hidden = new Set<string>();
    for (const f of projected) {
      if (f.type === "group" && f.layout && collapsed[f.name]) {
        for (const m of fieldsInBox(projected, f.layout, f.name)) hidden.add(m);
      }
    }
    return hidden;
  }, [projected, collapsed]);

  // The stage height: the lowest element bottom (design coords) plus a margin.
  const stageHeight = useMemo(() => {
    let bottom = 0;
    for (const f of projected) {
      if (f.layout) bottom = Math.max(bottom, f.layout.y + f.layout.height);
    }
    if (submitLayout) bottom = Math.max(bottom, submitLayout.y + submitLayout.height);
    if (titleLayout) bottom = Math.max(bottom, titleLayout.y + titleLayout.height);
    return bottom + 24;
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

  // The variable scope for `{name}` interpolation: external (process /
  // upstream-form) variables with this form's own live answers layered on top.
  const scope: Record<string, unknown> = { ...(variables ?? {}), ...values };
  const itext = (value: typeof schema.title) =>
    interpolate(resolveText(value, locale), scope);

  const title = itext(schema.title);
  const description = itext(schema.description);
  const titleStyle = titleTextStyle(schema.titleBox);
  // The title sits at its designed box in the stage when it has a layout; else it
  // stays in the header at the top of the form.
  const titleInStage = !!titleLayout && !!title;

  const isVisible = (field: FormField) =>
    !field.visibleIf || evaluateExpression(field.visibleIf, values);

  // The label + control + error for a field.
  const fieldInner = (field: FormField): ReactNode => {
    // Button field: handled directly here to access setValue / onSubmit.
    if (field.type === "button") {
      if (field.url) {
        return (
          <a
            href={field.url}
            target={field.urlTarget ?? "_blank"}
            rel="noopener noreferrer"
            className={`ff-btn ${buttonVariantClass(field.variant, schema.theme)}`}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}
          >
            {itext(field.title) || "Button"}
          </a>
        );
      }
      const handleBtnClick = () => {
        field.assignments?.forEach((a) => setValue(a.variable, a.value));
        if (field.closeOnClick) {
          const data: FormValues = { ...values };
          field.assignments?.forEach((a) => { data[a.variable] = a.value; });
          onSubmit?.(data);
        }
      };
      return (
        <button
          type="button"
          className={`ff-btn ${buttonVariantClass(field.variant, schema.theme)}`}
          style={{ width: "100%", height: "100%" }}
          onClick={handleBtnClick}
        >
          {itext(field.title) || "Button"}
        </button>
      );
    }

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
    const label = itext(field.title) || field.name;
    const fieldDesc = itext(field.description);
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

  return (
    <div
      ref={rootRef}
      className="ff-root"
      style={themeStyle}
      dir={i18n.dir(locale)}
    >
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
        className="ff-fields ff-fields-absolute"
        style={{
          position: "relative",
          width: stageWidth,
          height: stageHeight,
          maxWidth: "100%",
          marginInline: "auto",
        }}
      >
        {projected.map((field) => {
          if (!field.layout) return null;
          if (hiddenInCollapsed.has(field.name)) return null;
          if (!isVisible(field)) return null;
          const def = getFieldType(field.type);
          if (!def) return null;

          if (field.type === "group") {
            return (
              <GroupSection
                key={field.name}
                field={field}
                locale={locale}
                scope={scope}
                collapsed={!!collapsed[field.name]}
                left={sx(field.layout.x)}
                top={field.layout.y}
                widthCss={wcss(field.layout)}
                height={field.layout.height}
                zIndex={field.layout.zIndex}
                onToggle={() => toggleGroup(field.name)}
              />
            );
          }

          const isDisplay = def.group === "display";
          const error = errors[field.name];
          const className = `ff-field${isDisplay ? " ff-field-display" : ""}${
            error ? " has-error" : ""
          }`;
          return (
            <div
              key={field.name}
              className={className}
              style={{
                position: "absolute",
                left: sx(field.layout.x),
                top: field.layout.y,
                width: wcss(field.layout),
                zIndex: field.layout.zIndex,
                // autoHeight: CSS height is unset (content drives); fill-box
                // display types always use the designed height; otherwise explicit.
                height:
                  field.layout.autoHeight && !FILLS_BOX.has(field.type)
                    ? "auto"
                    : field.layout.height,
                maxHeight:
                  field.layout.autoHeight && !FILLS_BOX.has(field.type)
                    ? field.layout.maxHeight
                    : undefined,
                overflow:
                  field.layout.autoHeight &&
                  !FILLS_BOX.has(field.type) &&
                  field.layout.maxHeight
                    ? "auto"
                    : undefined,
              }}
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
              left: sx(titleLayout.x),
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

        {submitLayout && schema.submittable !== false && (
          <button
            type="button"
            className="ff-btn ff-btn-primary ff-submit-abs"
            onClick={handleSubmit}
            style={{
              position: "absolute",
              left: sx(submitLayout.x),
              top: submitLayout.y,
              width: wcss(submitLayout),
              height: submitLayout.height,
              zIndex: submitLayout.zIndex,
            }}
          >
            {itext(schema.submit?.label) || t("designer.preview.submit")}
          </button>
        )}
      </div>

      {/* Fall back to a normal action bar when the submit has no designed box. */}
      {!submitLayout && schema.submittable !== false && (
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

