// The property panel: curated editors for the selected field (driven by the
// field type's `editableProps`), or form-level title/description when nothing
// is selected. Localized text is edited in the base/default language here; the
// Translate tab handles other locales.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Breakpoint,
  Choice,
  ChoicesApi,
  CssUnit,
  FormField,
  FormTitle,
  LayoutBox,
  LocalizedText,
  TableApi,
} from "../types";
import { getFieldType, type EditableProp } from "../fieldTypes";
import { getLocaleText, setLocaleText } from "../text";
import {
  colToPx,
  CSS_UNITS,
  pxToCol,
  pxToUnit,
  unitToPx,
  WIDTH_UNITS,
} from "../units";
import { hasOwnLayout, resolveLayout, type Positioned } from "../responsive";
import {
  DEFAULT_CANVAS_WIDTH,
  FIELD_GAP,
  formColumns,
  GROUP_PAD,
  PAGE_PADDING,
} from "./canvasLayout";
import SignaturePad from "../fields/SignaturePad";
import Dropzone from "../fields/Dropzone";
import { fetchApiList } from "../fields/apiSource";
import type { FormModel } from "./useFormModel";
import {
  SUBMIT_NAME,
  TITLE_NAME,
  useDesigner,
  useDesignerStoreApi,
} from "./designerStore";

const BASE_LOCALE = "en";
const INPUT_TYPES = ["text", "email", "number", "tel", "url", "password"];
// Selectable max-height presets (px) for a checkbox options list.
const OPTIONS_MAX_HEIGHTS = [120, 160, 200, 240, 300, 400];

// Font stacks offered for the form title. The empty value inherits the theme's
// default font; the rest are generic, dependency-free families.
const TITLE_FONT_FAMILIES: { labelKey: string; value: string }[] = [
  { labelKey: "designer.title.fontDefault", value: "" },
  { labelKey: "designer.title.fontSans", value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { labelKey: "designer.title.fontSerif", value: "Georgia, 'Times New Roman', serif" },
  { labelKey: "designer.title.fontMono", value: "ui-monospace, 'Courier New', monospace" },
];

// Minimal info about the form's actor, used to offer actor-specific options
// (e.g. the "current actor signature" binding for a single-employee actor).
export type CurrentActorMeta = {
  isEmployee: boolean;
  employeeName?: string | null;
};

// A variable offered in the dynamic-text picker. BPM-agnostic on purpose: the
// host (App) maps in-scope process / upstream-form variables to this shape, so
// the form designer stays decoupled from the BPM modeler's types.
export type DesignerVariable = {
  name: string;
  // A human label for the tooltip (the producing task, or "Process variable").
  source?: string;
};

type PropertyPanelProps = {
  model: FormModel;
  currentActor?: CurrentActorMeta | null;
  // Process globals + variables produced by upstream forms, offered as
  // insertable `{name}` tokens in the dynamic-text editor. Optional.
  availableVariables?: DesignerVariable[];
};

export default function PropertyPanel({
  model,
  currentActor,
  availableVariables,
}: PropertyPanelProps) {
  const { t } = useTranslation("form");
  const store = useDesignerStoreApi();
  const activeBreakpoint = useDesigner((s) => s.activeBreakpoint);
  const field = model.selectedField;

  // The reference width for `%` / `col` sizes, and the canvas height for `%`
  // heights. The form's design width is constant across breakpoints (the canvas
  // never resizes when the active breakpoint changes), so widths resolve against
  // that single width on every breakpoint.
  const canvasW = model.schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasH = model.schema.canvas?.height ?? 720;
  const bpWidthBase = canvasW;

  // The form's column count, and the inner width a `col` field width is measured
  // against — the section's inner box when the item sits inside one, otherwise
  // the form's content area at the active breakpoint. Resolving the container
  // here is what makes "6 columns" mean 6 of the section vs 6 of the form.
  const columns = formColumns(model.schema);
  const colInnerFor = (item: Positioned | undefined, name: string): number => {
    const box = item ? resolveLayout(item, activeBreakpoint) : undefined;
    if (box && name !== SUBMIT_NAME) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      for (const g of model.fields) {
        if (g.type !== "group" || g.name === name) continue;
        const gb = resolveLayout(g, activeBreakpoint);
        if (
          gb &&
          cx >= gb.x &&
          cx <= gb.x + gb.width &&
          cy >= gb.y &&
          cy <= gb.y + gb.height
        ) {
          return Math.max(1, gb.width - GROUP_PAD * 2);
        }
      }
    }
    return Math.max(1, bpWidthBase - PAGE_PADDING * 2);
  };

  // Props common to every LayoutEditor: the active breakpoint, whether the
  // selected item overrides it (vs inherits), how to clear that override, and the
  // column grid its `col` width snaps to.
  const layoutBpProps = (item: Positioned | undefined, name: string) => ({
    widthBase: bpWidthBase,
    heightBase: canvasH,
    widthColumns: columns,
    widthColInner: colInnerFor(item, name),
    breakpoint: activeBreakpoint,
    overridden: item ? hasOwnLayout(item, activeBreakpoint) : false,
    onReset: () => store.getState().resetLayoutOverride(name),
  });

  // More than one widget selected → bulk actions instead of per-field editors.
  if (model.selectedNames.length > 1) {
    return (
      <aside className="dz-props">
        <h3 className="dz-props-title">
          {t("designer.multi.selected", { count: model.selectedNames.length })}
        </h3>
        <p className="dz-props-hint">{t("designer.multi.hint")}</p>
        <div className="dz-multi-actions">
          <button
            type="button"
            className="dz-multi-btn"
            onClick={() => store.getState().duplicateSelected()}
          >
            {t("designer.multi.duplicate")}
          </button>
          <button
            type="button"
            className="dz-multi-btn"
            onClick={() => store.getState().bringToFront()}
          >
            {t("designer.canvas.bringToFront")}
          </button>
          <button
            type="button"
            className="dz-multi-btn"
            onClick={() => store.getState().sendToBack()}
          >
            {t("designer.canvas.sendToBack")}
          </button>
          <button
            type="button"
            className="dz-multi-btn is-danger"
            onClick={() => store.getState().deleteSelected()}
          >
            {t("designer.multi.delete")}
          </button>
        </div>
      </aside>
    );
  }

  // The submit button: layout-only properties, and no delete (it's permanent).
  if (
    model.selectedNames.length === 1 &&
    model.selectedNames[0] === SUBMIT_NAME
  ) {
    const submitLayout = resolveLayout(model.schema.submit, activeBreakpoint);
    return (
      <aside className="dz-props">
        <h3 className="dz-props-title">{t("designer.submit.title")}</h3>
        <p className="dz-props-hint">{t("designer.submit.hint")}</p>
        {submitLayout && (
          <LayoutEditor
            layout={submitLayout}
            {...layoutBpProps(model.schema.submit, SUBMIT_NAME)}
            onChange={(p) => model.updateLayout(SUBMIT_NAME, p)}
            onFront={() => store.getState().bringToFront()}
            onBack={() => store.getState().sendToBack()}
          />
        )}
      </aside>
    );
  }

  // The form title: its text, typography, and layout (no delete — it's permanent).
  if (
    model.selectedNames.length === 1 &&
    model.selectedNames[0] === TITLE_NAME
  ) {
    const titleBox = model.schema.titleBox;
    const titleLayout = resolveLayout(titleBox, activeBreakpoint);
    const setStyle = (
      patch: Partial<
        Pick<FormTitle, "fontSize" | "fontFamily" | "bold" | "italic" | "color">
      >,
    ) => store.getState().updateTitleStyle(patch);
    return (
      <aside className="dz-props">
        <h3 className="dz-props-title">{t("designer.title.title")}</h3>
        <p className="dz-props-hint">{t("designer.title.hint")}</p>

        <LocalizedRow
          label={t("designer.props.formTitle")}
          value={model.schema.title}
          onChange={(v) => model.updateForm({ title: v })}
        />

        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.title.fontSize")}</span>
          <input
            className="dz-prop-input"
            type="number"
            min={8}
            max={120}
            placeholder="24"
            value={titleBox?.fontSize ?? ""}
            onChange={(e) =>
              setStyle({
                fontSize:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </label>

        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.title.fontFamily")}</span>
          <select
            className="dz-prop-input"
            value={titleBox?.fontFamily ?? ""}
            onChange={(e) => setStyle({ fontFamily: e.target.value || undefined })}
          >
            {TITLE_FONT_FAMILIES.map((f) => (
              <option key={f.labelKey} value={f.value}>
                {t(f.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <div className="dz-prop">
          <span className="dz-prop-label">{t("designer.title.fontStyle")}</span>
          <div className="dz-title-style-row">
            <label className="dz-prop-check">
              <input
                type="checkbox"
                checked={Boolean(titleBox?.bold)}
                onChange={(e) => setStyle({ bold: e.target.checked })}
              />
              <span>{t("designer.title.bold")}</span>
            </label>
            <label className="dz-prop-check">
              <input
                type="checkbox"
                checked={Boolean(titleBox?.italic)}
                onChange={(e) => setStyle({ italic: e.target.checked })}
              />
              <span>{t("designer.title.italic")}</span>
            </label>
          </div>
        </div>

        <div className="dz-prop">
          <span className="dz-prop-label">{t("designer.title.color")}</span>
          <div className="dz-title-color-row">
            <input
              type="color"
              value={titleBox?.color || "#1f2937"}
              onChange={(e) => setStyle({ color: e.target.value })}
            />
            {titleBox?.color && (
              <button
                type="button"
                className="dz-multi-btn"
                onClick={() => setStyle({ color: undefined })}
              >
                {t("designer.title.resetColor")}
              </button>
            )}
          </div>
        </div>

        {titleLayout && (
          <LayoutEditor
            layout={titleLayout}
            {...layoutBpProps(titleBox, TITLE_NAME)}
            onChange={(p) => model.updateLayout(TITLE_NAME, p)}
            onFront={() => store.getState().bringToFront()}
            onBack={() => store.getState().sendToBack()}
          />
        )}
      </aside>
    );
  }

  if (!field) {
    return (
      <aside className="dz-props">
        <h3 className="dz-props-title">{t("designer.formSettings")}</h3>
        <LocalizedRow
          label={t("designer.props.formTitle")}
          value={model.schema.title}
          onChange={(v) => model.updateForm({ title: v })}
        />
        <LocalizedRow
          label={t("designer.props.formDescription")}
          multiline
          value={model.schema.description}
          onChange={(v) => model.updateForm({ description: v })}
        />
        <GapEditor
          gapX={model.schema.canvas?.gapX ?? FIELD_GAP}
          gapY={model.schema.canvas?.gapY ?? FIELD_GAP}
          onChange={(g) => store.getState().setGap(g)}
        />
        <FormColumnsEditor
          columns={columns}
          onChange={(n) => store.getState().setColumns(n)}
        />
        <FormMaxWidthEditor
          maxWidth={model.schema.canvas?.maxWidth}
          onChange={(n) => store.getState().setMaxWidth(n)}
        />
        <p className="dz-props-hint">{t("designer.selectFieldHint")}</p>
      </aside>
    );
  }

  const def = getFieldType(field.type);
  const editable = def?.editableProps ?? [];
  const has = (prop: EditableProp) => editable.includes(prop);
  const patch = (p: Partial<FormField>) => model.updateField(field.name, p);

  return (
    <aside className="dz-props">
      <h3 className="dz-props-title">
        {def ? t(`designer.types.${def.labelKey}`) : field.type}
      </h3>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.id")}</span>
        <input
          className="dz-prop-input"
          type="text"
          value={field.id ?? ""}
          onChange={(e) => patch({ id: e.target.value })}
        />
      </label>

      {has("title") && (
        <LocalizedRow
          label={t("designer.props.title")}
          value={field.title}
          onChange={(v) => patch({ title: v })}
        />
      )}

      {has("name") && <NameRow model={model} field={field} />}

      {has("description") && (
        <LocalizedRow
          label={t("designer.props.description")}
          multiline
          value={field.description}
          onChange={(v) => patch({ description: v })}
        />
      )}

      {has("placeholder") && (
        <LocalizedRow
          label={t("designer.props.placeholder")}
          value={field.placeholder}
          onChange={(v) => patch({ placeholder: v })}
        />
      )}

      {has("inputType") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.inputType")}</span>
          <select
            className="dz-prop-input"
            value={field.inputType ?? "text"}
            onChange={(e) => patch({ inputType: e.target.value })}
          >
            {INPUT_TYPES.map((it) => (
              <option key={it} value={it}>
                {t(`designer.inputTypes.${it}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      {has("rateMax") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.rateMax")}</span>
          <input
            className="dz-prop-input"
            type="number"
            min={2}
            max={10}
            value={field.rateMax ?? 5}
            onChange={(e) =>
              patch({
                rateMax: Math.max(2, Math.min(10, Number(e.target.value) || 5)),
              })
            }
          />
        </label>
      )}

      {has("html") && (
        <LocalizedRow
          label={t("designer.props.html")}
          multiline
          value={field.html}
          onChange={(v) => patch({ html: v })}
        />
      )}

      {has("dynamicText") && (
        <DynamicTextEditor
          field={field}
          patch={patch}
          ownVariables={ownVariablesFor(model, field.name)}
          externalVariables={availableVariables ?? []}
        />
      )}

      {has("src") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.src")}</span>
          <input
            className="dz-prop-input"
            type="url"
            placeholder="https://…"
            value={field.src ?? ""}
            onChange={(e) => patch({ src: e.target.value })}
          />
        </label>
      )}

      {has("imageSource") && <ImageSourceSection field={field} patch={patch} />}

      {has("alt") && (
        <LocalizedRow
          label={t("designer.props.alt")}
          value={field.alt}
          onChange={(v) => patch({ alt: v })}
        />
      )}

      {has("height") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.height")}</span>
          <input
            className="dz-prop-input"
            type="number"
            min={40}
            value={field.height ?? ""}
            onChange={(e) =>
              patch({
                height:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </label>
      )}

      {has("accept") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.accept")}</span>
          <input
            className="dz-prop-input"
            type="text"
            placeholder=".pdf,.docx,image/*"
            value={field.accept ?? ""}
            onChange={(e) => patch({ accept: e.target.value || undefined })}
          />
        </label>
      )}

      {has("collapsible") && (
        <label className="dz-prop dz-prop-check">
          <input
            type="checkbox"
            checked={Boolean(field.collapsible)}
            onChange={(e) => patch({ collapsible: e.target.checked })}
          />
          <span>{t("designer.props.collapsible")}</span>
        </label>
      )}

      {has("choices") && <ChoicesSection field={field} patch={patch} />}

      {has("table") && (
        <TableEditor
          field={field}
          patch={patch}
          ownVariables={ownVariablesFor(model, field.name)}
          externalVariables={availableVariables ?? []}
        />
      )}

      {has("optionsMaxHeight") && (
        <label className="dz-prop">
          <span className="dz-prop-label">
            {t("designer.props.optionsMaxHeight")}
          </span>
          <select
            className="dz-prop-input"
            value={field.optionsMaxHeight ?? ""}
            onChange={(e) =>
              patch({
                optionsMaxHeight:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          >
            <option value="">{t("designer.props.optionsMaxHeightNone")}</option>
            {OPTIONS_MAX_HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {t("designer.props.px", { n: h })}
              </option>
            ))}
          </select>
        </label>
      )}

      {has("signatureDisplay") && (
        <SignatureDisplaySection
          field={field}
          patch={patch}
          currentActor={currentActor ?? null}
        />
      )}

      {has("isRequired") &&
        !(field.signatureSource && field.signatureSource !== "user") && (
          <label className="dz-prop dz-prop-check">
            <input
              type="checkbox"
              checked={Boolean(field.isRequired)}
              onChange={(e) => patch({ isRequired: e.target.checked })}
            />
            <span>{t("designer.props.required")}</span>
          </label>
        )}

      {field.layout && (
        <LayoutEditor
          layout={resolveLayout(field, activeBreakpoint) ?? field.layout}
          {...layoutBpProps(field, field.name)}
          onChange={(p) => model.updateLayout(field.name, p)}
          onFront={() => store.getState().bringToFront()}
          onBack={() => store.getState().sendToBack()}
        />
      )}
    </aside>
  );
}

// Form-level element spacing: the horizontal and vertical gap the designer keeps
// between elements when stacking, reflowing on resize, and reordering. Edits
// commit to the store (coalesced) and take effect on the next layout change.
function GapEditor({
  gapX,
  gapY,
  onChange,
}: {
  gapX: number;
  gapY: number;
  onChange: (gap: { x?: number; y?: number }) => void;
}) {
  const { t } = useTranslation("form");
  const num = (value: number, label: string, set: (n: number) => void) => (
    <label className="dz-prop">
      <span className="dz-prop-label">{label}</span>
      <input
        className="dz-prop-input"
        type="number"
        min={0}
        value={value}
        onChange={(e) => set(Math.max(0, Math.round(Number(e.target.value) || 0)))}
      />
    </label>
  );

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.gap.section")}</span>
      <p className="dz-prop-hint">{t("designer.gap.hint")}</p>
      <div className="dz-layout-grid">
        {num(gapX, t("designer.gap.horizontal"), (x) => onChange({ x }))}
        {num(gapY, t("designer.gap.vertical"), (y) => onChange({ y }))}
      </div>
    </div>
  );
}

// Form-level column count: how many columns the form width is divided into for
// `col`-unit field widths. The canvas draws this many guide columns and a field's
// `col` width snaps to / is capped at this count. Coalesced in history.
function FormColumnsEditor({
  columns,
  onChange,
}: {
  columns: number;
  onChange: (columns: number) => void;
}) {
  const { t } = useTranslation("form");
  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.formColumns")}</span>
      <input
        className="dz-prop-input"
        type="number"
        min={1}
        max={24}
        value={columns}
        onChange={(e) =>
          onChange(Math.max(1, Math.min(24, Math.round(Number(e.target.value) || 12))))
        }
      />
      <p className="dz-prop-hint">{t("designer.props.formColumnsHint")}</p>
    </label>
  );
}

// Form-level max width (px): the form fills its container up to this cap, then
// centres — so it (and its full-width fields) fills the available width without
// growing unbounded on wide screens. Empty = no cap. Coalesced in history.
function FormMaxWidthEditor({
  maxWidth,
  onChange,
}: {
  maxWidth: number | undefined;
  onChange: (maxWidth: number | undefined) => void;
}) {
  const { t } = useTranslation("form");
  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.maxWidth")}</span>
      <input
        className="dz-prop-input"
        type="number"
        min={0}
        placeholder={t("designer.props.maxWidthNone")}
        value={maxWidth ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Math.max(0, Math.round(Number(v) || 0)));
        }}
      />
      <p className="dz-prop-hint">{t("designer.props.maxWidthHint")}</p>
    </label>
  );
}

// Absolute placement on the design canvas: position (X/Y), size (W/H), stacking
// order (Z), plus quick bring-to-front / send-to-back. Edits commit to the store
// (coalesced) and reflect live on the canvas.
function LayoutEditor({
  layout,
  widthBase,
  heightBase,
  widthColumns,
  widthColInner,
  breakpoint,
  overridden,
  onReset,
  onChange,
  onFront,
  onBack,
}: {
  layout: LayoutBox;
  // The reference length (px) a `%` width / height is measured against — the
  // active breakpoint's design width and the canvas height respectively.
  widthBase: number;
  heightBase: number;
  // The form's column count and the inner width (px) one `col` of WIDTH spans —
  // the container (form or section) this item sits in. Width-only.
  widthColumns: number;
  widthColInner: number;
  // The breakpoint being edited, whether this item overrides it, and a reset.
  breakpoint: Breakpoint;
  overridden: boolean;
  onReset: () => void;
  onChange: (patch: Partial<LayoutBox>) => void;
  onFront: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation("form");
  const num = (key: "x" | "y" | "zIndex", label: string, min = 0) => (
    <label className="dz-prop">
      <span className="dz-prop-label">{label}</span>
      <input
        className="dz-prop-input"
        type="number"
        min={min}
        value={layout[key]}
        onChange={(e) => onChange({ [key]: Math.round(Number(e.target.value) || 0) })}
      />
    </label>
  );

  // A size field (width or height): the value is shown/edited in the chosen unit
  // and stored back as canvas px, so the geometry stays pixel-exact while the
  // designer authors in their preferred unit. The unit dropdown changes only how
  // the size is expressed (px is left untouched). `col` (width only) shows a
  // column span clamped to the container's column count, so it can't exceed it.
  const dim = (
    sizeKey: "width" | "height",
    unitKey: "widthUnit" | "heightUnit",
    label: string,
    base: number,
    units: CssUnit[],
  ) => {
    // Width defaults to columns (the designer's default sizing model); height,
    // which has no column concept, defaults to `%`.
    const unit: CssUnit =
      layout[unitKey] ?? (sizeKey === "width" ? "col" : "%");
    const isCol = unit === "col";
    const shown = isCol
      ? pxToCol(layout[sizeKey], widthColInner, widthColumns)
      : pxToUnit(layout[sizeKey], unit, base);
    const commit = (raw: number) =>
      onChange({
        [sizeKey]: isCol
          ? colToPx(raw, widthColInner, widthColumns)
          : unitToPx(raw, unit, base),
      });
    return (
      <label className="dz-prop">
        <span className="dz-prop-label">
          {label}
          {isCol && (
            <span className="dz-dim-of"> / {widthColumns}</span>
          )}
        </span>
        <div className="dz-dim-row">
          <input
            className="dz-prop-input"
            type="number"
            min={isCol ? 1 : 0}
            max={isCol ? widthColumns : undefined}
            step={unit === "px" || isCol ? 1 : 0.1}
            value={shown}
            onChange={(e) => commit(Number(e.target.value) || 0)}
          />
          <select
            className="dz-prop-input dz-dim-unit"
            value={unit}
            aria-label={t("designer.layout.unit")}
            onChange={(e) => onChange({ [unitKey]: e.target.value as CssUnit })}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </label>
    );
  };

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.layout.section")}</span>
      {breakpoint !== "base" && (
        <div className="dz-bp-note">
          <span>
            {t("designer.layout.editingBp", {
              bp: t(`designer.breakpoints.${breakpoint}`),
            })}
          </span>
          {overridden ? (
            <button type="button" className="dz-bp-reset" onClick={onReset}>
              {t("designer.layout.resetOverride")}
            </button>
          ) : (
            <span className="dz-bp-inherited">
              {t("designer.layout.inherited")}
            </span>
          )}
        </div>
      )}
      <div className="dz-layout-grid">
        {num("x", t("designer.layout.x"))}
        {num("y", t("designer.layout.y"))}
        {dim("width", "widthUnit", t("designer.layout.width"), widthBase, WIDTH_UNITS)}
        {dim("height", "heightUnit", t("designer.layout.height"), heightBase, CSS_UNITS)}
        {num("zIndex", t("designer.layout.zIndex"), 0)}
      </div>
      <div className="dz-layout-order">
        <button type="button" className="dz-multi-btn" onClick={onBack}>
          {t("designer.canvas.sendToBack")}
        </button>
        <button type="button" className="dz-multi-btn" onClick={onFront}>
          {t("designer.canvas.bringToFront")}
        </button>
      </div>
    </div>
  );
}

// ── Editors ───────────────────────────────────────────────────────────────

// The form's own answerable fields, offered as `{name}` tokens a dynamic-text
// field can reference. Excludes display-only fields (they carry no answer) and
// the dynamic-text field itself.
function ownVariablesFor(model: FormModel, selfName: string): DesignerVariable[] {
  return model.fields
    .filter(
      (f) =>
        f.name !== selfName && getFieldType(f.type)?.group !== "display",
    )
    .map((f) => ({
      name: f.name,
      source: getLocaleText(f.title, BASE_LOCALE) || f.name,
    }));
}

// Dynamic-text content editor: a plain-text template plus one-click insertion
// of `{variable}` tokens. The template is localizable (edited in the base
// language here; the Translate tab handles other locales). Clicking a variable
// chip splices its token in at the caret.
function DynamicTextEditor({
  field,
  patch,
  ownVariables,
  externalVariables,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
  ownVariables: DesignerVariable[];
  externalVariables: DesignerVariable[];
}) {
  const { t } = useTranslation("form");
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = getLocaleText(field.text, BASE_LOCALE);

  const setText = (next: string) =>
    patch({ text: setLocaleText(field.text, BASE_LOCALE, next) });

  const insert = (name: string) => {
    const token = `{${name}}`;
    const current = getLocaleText(field.text, BASE_LOCALE);
    const el = ref.current;
    if (!el) {
      setText(current + token);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    setText(current.slice(0, start) + token + current.slice(end));
    // Restore focus and drop the caret just past the inserted token.
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.dynamicText")}</span>
      <textarea
        ref={ref}
        className="dz-prop-input"
        rows={3}
        value={text}
        placeholder={t("designer.props.dynamicTextPlaceholder")}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="dz-prop-hint">{t("designer.props.dynamicTextHint")}</p>
      <VariablePicker
        ownVariables={ownVariables}
        externalVariables={externalVariables}
        onInsert={insert}
      />
    </label>
  );
}

// A two-group picker of insertable `{variable}` chips — the form's own answer
// fields and the in-scope process / upstream-form variables. Clicking a chip
// calls `onInsert(name)`; the mousedown is prevented so the field the caret is
// in keeps focus and the token can be spliced in at the caret. Renders nothing
// when there's nothing to offer. Shared by the dynamic-text and table editors.
function VariablePicker({
  ownVariables,
  externalVariables,
  onInsert,
}: {
  ownVariables: DesignerVariable[];
  externalVariables: DesignerVariable[];
  onInsert: (name: string) => void;
}) {
  const { t } = useTranslation("form");
  // Don't offer an external variable that a same-named own field already covers.
  const ownNames = new Set(ownVariables.map((v) => v.name));
  const externals = externalVariables.filter((v) => !ownNames.has(v.name));
  if (ownVariables.length === 0 && externals.length === 0) return null;

  const chips = (vars: DesignerVariable[]) => (
    <div className="dz-var-chips">
      {vars.map((v) => (
        <button
          key={v.name}
          type="button"
          className="dz-var-chip"
          title={v.source}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(v.name)}
        >
          {v.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="dz-var-picker">
      {ownVariables.length > 0 && (
        <div className="dz-var-group">
          <span className="dz-var-group-label">
            {t("designer.props.varsThisForm")}
          </span>
          {chips(ownVariables)}
        </div>
      )}
      {externals.length > 0 && (
        <div className="dz-var-group">
          <span className="dz-var-group-label">
            {t("designer.props.varsProcess")}
          </span>
          {chips(externals)}
        </div>
      )}
    </div>
  );
}

function LocalizedRow({
  label,
  value,
  multiline,
  onChange,
}: {
  label: string;
  value: LocalizedText | undefined;
  multiline?: boolean;
  onChange: (value: LocalizedText) => void;
}) {
  const text = getLocaleText(value, BASE_LOCALE);
  const set = (next: string) =>
    onChange(setLocaleText(value, BASE_LOCALE, next));
  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{label}</span>
      {multiline ? (
        <textarea
          className="dz-prop-input"
          rows={3}
          value={text}
          onChange={(e) => set(e.target.value)}
        />
      ) : (
        <input
          className="dz-prop-input"
          type="text"
          value={text}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </label>
  );
}

// Field key editor: local state committed on blur; reverts on collision.
function NameRow({ model, field }: { model: FormModel; field: FormField }) {
  const { t } = useTranslation("form");
  const [draft, setDraft] = useState(field.name);
  const [error, setError] = useState(false);

  // Re-seed when the selected field changes.
  useEffect(() => {
    setDraft(field.name);
    setError(false);
  }, [field.name]);

  const commit = () => {
    if (draft === field.name) return;
    const ok = model.renameField(field.name, draft);
    if (!ok) {
      setError(true);
      setDraft(field.name);
    } else {
      setError(false);
    }
  };

  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.name")}</span>
      <input
        className={`dz-prop-input${error ? " has-error" : ""}`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && (
        <span className="dz-prop-error">{t("designer.props.nameTaken")}</span>
      )}
    </label>
  );
}

function ChoicesEditor({
  choices,
  onChange,
}: {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}) {
  const { t } = useTranslation("form");

  const setText = (index: number, text: string) => {
    onChange(
      choices.map((c, i) =>
        i === index
          ? { ...c, text: setLocaleText(c.text, BASE_LOCALE, text) }
          : c,
      ),
    );
  };
  const remove = (index: number) =>
    onChange(choices.filter((_, i) => i !== index));
  const add = () => {
    const taken = new Set(choices.map((c) => c.value));
    let n = choices.length + 1;
    while (taken.has(`item${n}`)) n += 1;
    onChange([
      ...choices,
      { value: `item${n}`, text: { default: `Option ${n}` } },
    ]);
  };

  return (
    <div className="dz-prop">
      <div className="dz-choices">
        {choices.map((choice, index) => (
          <div key={choice.value} className="dz-choice-row">
            <input
              className="dz-prop-input"
              type="text"
              value={getLocaleText(choice.text, BASE_LOCALE)}
              onChange={(e) => setText(index, e.target.value)}
            />
            <button
              type="button"
              className="dz-choice-remove"
              aria-label={t("designer.props.removeChoice")}
              onClick={() => remove(index)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="dz-choice-add" onClick={add}>
        + {t("designer.props.addChoice")}
      </button>
    </div>
  );
}

// Options source for a choice field: a manual list, or a remote API mapped via
// value/display keys.
function ChoicesSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  const source = field.choicesSource ?? "manual";
  const api: ChoicesApi = field.choicesApi ?? {
    url: "",
    path: "",
    valueKey: "id",
    displayKey: "name",
  };
  const setApi = (p: Partial<ChoicesApi>) =>
    patch({ choicesApi: { ...api, ...p } });

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.choices")}</span>

      <div className="dz-source-toggle">
        <button
          type="button"
          className={source === "manual" ? "is-active" : ""}
          onClick={() => patch({ choicesSource: "manual" })}
        >
          {t("designer.choicesApi.manual")}
        </button>
        <button
          type="button"
          className={source === "api" ? "is-active" : ""}
          onClick={() => patch({ choicesSource: "api", choicesApi: api })}
        >
          {t("designer.choicesApi.api")}
        </button>
      </div>

      {source === "manual" ? (
        <ChoicesEditor
          choices={field.choices ?? []}
          onChange={(choices) => patch({ choices })}
        />
      ) : (
        <div className="dz-api">
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.choicesApi.url")}
            </span>
            <input
              className="dz-prop-input"
              type="url"
              placeholder="https://api.example.com/categories"
              value={api.url}
              onChange={(e) => setApi({ url: e.target.value })}
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.choicesApi.path")}
            </span>
            <input
              className="dz-prop-input"
              type="text"
              placeholder="categories.data"
              value={api.path ?? ""}
              onChange={(e) => setApi({ path: e.target.value })}
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.choicesApi.valueKey")}
            </span>
            <input
              className="dz-prop-input"
              type="text"
              placeholder="id"
              value={api.valueKey}
              onChange={(e) => setApi({ valueKey: e.target.value })}
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.choicesApi.displayKey")}
            </span>
            <input
              className="dz-prop-input"
              type="text"
              placeholder="name"
              value={api.displayKey}
              onChange={(e) => setApi({ displayKey: e.target.value })}
            />
          </label>
          <p className="dz-prop-hint">{t("designer.choicesApi.hint")}</p>
        </div>
      )}
    </div>
  );
}

// Display-table editor. Two data sources, like the choice fields:
//  - "manual": edit the body rows by hand. Header and cell text may embed
//    {variable} tokens, resolved at runtime.
//  - "api": rows come from an endpoint (URL + items path + a key per column),
//    optionally bracketed by manual top/bottom rows (e.g. a totals row).
// Columns stay aligned across every row set and the API column keys: adding or
// removing a column updates them all. Localizable text is edited in the base
// language here; the Translate tab handles other locales.
function TableEditor({
  field,
  patch,
  ownVariables,
  externalVariables,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
  ownVariables: DesignerVariable[];
  externalVariables: DesignerVariable[];
}) {
  const { t } = useTranslation("form");
  const columns = field.tableColumns ?? [];
  const colCount = columns.length;
  const source = field.tableSource ?? "manual";
  const api: TableApi = field.tableApi ?? { url: "", path: "", columnKeys: [] };
  // Editing the endpoint invalidates any prior test result.
  const setApi = (p: Partial<TableApi>) => {
    setTestState("idle");
    setTestMsg("");
    patch({ tableApi: { ...api, ...p } });
  };

  // "Test connection" result: fetch the endpoint, resolve the items path, and
  // report how many rows came back (or the failure).
  const [testState, setTestState] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");
  const testConnection = async () => {
    if (!api.url.trim()) return;
    setTestState("checking");
    setTestMsg(t("designer.table.apiTesting"));
    try {
      const items = await fetchApiList(api.url, api.path);
      setTestState("ok");
      setTestMsg(t("designer.table.apiOk", { count: items.length }));
    } catch {
      setTestState("error");
      setTestMsg(t("designer.table.apiTestError"));
    }
  };

  const setHeader = (index: number, text: string) =>
    patch({
      tableColumns: columns.map((c, i) =>
        i === index ? setLocaleText(c, BASE_LOCALE, text) : c,
      ),
    });
  const setKey = (index: number, key: string) =>
    setApi({
      columnKeys: columns.map((_, i) =>
        i === index ? key : api.columnKeys[i] ?? "",
      ),
    });

  // Adding/removing a column keeps every aligned structure in step: each row of
  // tableRows / tableTopRows / tableBottomRows, and the API column keys.
  const widenRows = (rows: LocalizedText[][] | undefined) =>
    (rows ?? []).map((row) => [...row, { default: "" } as LocalizedText]);
  const dropCol = (rows: LocalizedText[][] | undefined, index: number) =>
    (rows ?? []).map((row) => row.filter((_, i) => i !== index));

  const addColumn = () =>
    patch({
      tableColumns: [...columns, { default: `Column ${colCount + 1}` }],
      tableRows: widenRows(field.tableRows),
      tableTopRows: widenRows(field.tableTopRows),
      tableBottomRows: widenRows(field.tableBottomRows),
      tableApi: { ...api, columnKeys: [...api.columnKeys, ""] },
    });
  const removeColumn = (index: number) =>
    patch({
      tableColumns: columns.filter((_, i) => i !== index),
      tableRows: dropCol(field.tableRows, index),
      tableTopRows: dropCol(field.tableTopRows, index),
      tableBottomRows: dropCol(field.tableBottomRows, index),
      tableApi: {
        ...api,
        columnKeys: api.columnKeys.filter((_, i) => i !== index),
      },
    });

  // ── Variable insertion ─────────────────────────────────────────────────────
  // The header/cell input the caret is in, tracked on focus, so a clicked
  // variable token inserts there. The variable chips prevent their mousedown so
  // this input stays focused and the caret survives the click.
  type RowKind = "tableRows" | "tableTopRows" | "tableBottomRows";
  const activeCell = useRef<{
    el: HTMLInputElement;
    kind: "header" | RowKind;
    row: number;
    col: number;
  } | null>(null);

  const writeRowCell = (kind: RowKind, row: number, col: number, next: string) => {
    const list = field[kind] ?? [];
    patch({
      [kind]: list.map((r, ri) =>
        ri === row
          ? Array.from({ length: colCount }, (_, ci) =>
              ci === col
                ? setLocaleText(r[ci], BASE_LOCALE, next)
                : r[ci] ?? { default: "" },
            )
          : r,
      ),
    } as Partial<FormField>);
  };

  const insertVariable = (name: string) => {
    const target = activeCell.current;
    if (!target) return;
    const el = target.el;
    const value = el.value;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const token = `{${name}}`;
    const next = value.slice(0, start) + token + value.slice(end);
    if (target.kind === "header") setHeader(target.col, next);
    else writeRowCell(target.kind, target.row, target.col, next);
    // Restore focus and drop the caret just past the inserted token.
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.table")}</span>

      <label className="dz-prop-check">
        <input
          type="checkbox"
          checked={field.tableHeader !== false}
          onChange={(e) => patch({ tableHeader: e.target.checked })}
        />
        <span>{t("designer.table.showHeader")}</span>
      </label>

      <div className="dz-source-toggle">
        <button
          type="button"
          className={source === "manual" ? "is-active" : ""}
          onClick={() => patch({ tableSource: "manual" })}
        >
          {t("designer.choicesApi.manual")}
        </button>
        <button
          type="button"
          className={source === "api" ? "is-active" : ""}
          onClick={() => patch({ tableSource: "api", tableApi: api })}
        >
          {t("designer.choicesApi.api")}
        </button>
      </div>

      <span className="dz-prop-sublabel">{t("designer.table.columns")}</span>
      <div className="dz-table-rows">
        {columns.map((col, i) => (
          <div key={i} className="dz-table-row">
            <input
              className="dz-prop-input"
              type="text"
              placeholder={t("designer.table.headerPlaceholder")}
              value={getLocaleText(col, BASE_LOCALE)}
              onFocus={(e) =>
                (activeCell.current = {
                  el: e.currentTarget,
                  kind: "header",
                  row: 0,
                  col: i,
                })
              }
              onChange={(e) => setHeader(i, e.target.value)}
            />
            {source === "api" && (
              <input
                className="dz-prop-input dz-table-key"
                type="text"
                placeholder={t("designer.table.keyPlaceholder")}
                value={api.columnKeys[i] ?? ""}
                onChange={(e) => setKey(i, e.target.value)}
              />
            )}
            <button
              type="button"
              className="dz-choice-remove"
              aria-label={t("designer.table.removeColumn")}
              disabled={colCount <= 1}
              onClick={() => removeColumn(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="dz-choice-add" onClick={addColumn}>
        + {t("designer.table.addColumn")}
      </button>

      {source === "manual" ? (
        <>
          <span className="dz-prop-sublabel">{t("designer.table.rows")}</span>
          <TableRowsEditor
            rows={field.tableRows ?? []}
            colCount={colCount}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableRows: rows })}
            onCellFocus={(el, row, col) =>
              (activeCell.current = { el, kind: "tableRows", row, col })
            }
          />
        </>
      ) : (
        <>
          <label className="dz-prop">
            <span className="dz-prop-label">{t("designer.choicesApi.url")}</span>
            <input
              className="dz-prop-input"
              type="url"
              placeholder="https://api.example.com/rows"
              value={api.url}
              onChange={(e) => setApi({ url: e.target.value })}
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">{t("designer.choicesApi.path")}</span>
            <input
              className="dz-prop-input"
              type="text"
              placeholder="data.rows"
              value={api.path ?? ""}
              onChange={(e) => setApi({ path: e.target.value })}
            />
          </label>
          <div className="dz-api-test">
            <button
              type="button"
              className="dz-choice-add"
              disabled={testState === "checking" || !api.url.trim()}
              onClick={() => void testConnection()}
            >
              {testState === "checking"
                ? t("designer.table.apiTesting")
                : t("designer.table.apiTest")}
            </button>
            {testMsg && (
              <span className={`dz-api-test-msg dz-api-test-${testState}`}>{testMsg}</span>
            )}
          </div>
          <p className="dz-prop-hint">{t("designer.table.apiHint")}</p>

          <span className="dz-prop-sublabel">{t("designer.table.topRows")}</span>
          <TableRowsEditor
            rows={field.tableTopRows ?? []}
            colCount={colCount}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableTopRows: rows })}
            onCellFocus={(el, row, col) =>
              (activeCell.current = { el, kind: "tableTopRows", row, col })
            }
          />
          <span className="dz-prop-sublabel">
            {t("designer.table.bottomRows")}
          </span>
          <TableRowsEditor
            rows={field.tableBottomRows ?? []}
            colCount={colCount}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableBottomRows: rows })}
            onCellFocus={(el, row, col) =>
              (activeCell.current = { el, kind: "tableBottomRows", row, col })
            }
          />
        </>
      )}

      <p className="dz-prop-hint">{t("designer.table.variableHint")}</p>
      <VariablePicker
        ownVariables={ownVariables}
        externalVariables={externalVariables}
        onInsert={insertVariable}
      />
    </div>
  );
}

// Editor for one set of manual table rows (the body, or an API table's top /
// bottom rows). Each row has one cell input per column, aligned to `colCount`,
// plus a remove button; an add button appends an empty row.
function TableRowsEditor({
  rows,
  colCount,
  addLabel,
  removeLabel,
  onChange,
  onCellFocus,
}: {
  rows: LocalizedText[][];
  colCount: number;
  addLabel: string;
  removeLabel: string;
  onChange: (rows: LocalizedText[][]) => void;
  // Reports which cell input gained focus, so the table editor can target it
  // for `{variable}` insertion.
  onCellFocus?: (el: HTMLInputElement, row: number, col: number) => void;
}) {
  const setCell = (r: number, c: number, text: string) =>
    onChange(
      rows.map((row, ri) =>
        ri === r
          ? Array.from({ length: colCount }, (_, ci) =>
              ci === c
                ? setLocaleText(row[ci], BASE_LOCALE, text)
                : row[ci] ?? { default: "" },
            )
          : row,
      ),
    );
  const addRow = () =>
    onChange([
      ...rows,
      Array.from({ length: colCount }, () => ({ default: "" })),
    ]);
  const removeRow = (index: number) =>
    onChange(rows.filter((_, i) => i !== index));

  return (
    <>
      <div className="dz-table-rows">
        {rows.map((row, r) => (
          <div key={r} className="dz-table-row">
            {Array.from({ length: colCount }, (_, c) => (
              <input
                key={c}
                className="dz-prop-input"
                type="text"
                value={getLocaleText(row[c], BASE_LOCALE)}
                onFocus={(e) => onCellFocus?.(e.currentTarget, r, c)}
                onChange={(e) => setCell(r, c, e.target.value)}
              />
            ))}
            <button
              type="button"
              className="dz-choice-remove"
              aria-label={removeLabel}
              onClick={() => removeRow(r)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="dz-choice-add" onClick={addRow}>
        + {addLabel}
      </button>
    </>
  );
}

// Display signature: choose a preset image or the current actor's signature.
// Image source picker for the image display field: paste a URL, or upload a file
// from the device (read as a base64 data URL and stored in `src`, so it travels
// with the schema). A preview of the current image is shown with a remove
// button. The runtime <img> renders either a URL or a data URL transparently.
function ImageSourceSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  const src = field.src ?? "";
  // Uploaded images are stored as base64 data URLs; a pasted link is an http(s)
  // URL. The initial tab follows whichever the current value is.
  const isUpload = src.startsWith("data:");
  const [mode, setMode] = useState<"url" | "upload">(isUpload ? "upload" : "url");

  // Read the chosen image as a base64 data URL and store it in `src`.
  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => patch({ src: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.imageSource")}</span>

      <div className="dz-source-toggle">
        <button
          type="button"
          className={mode === "url" ? "is-active" : ""}
          onClick={() => setMode("url")}
        >
          {t("designer.image.url")}
        </button>
        <button
          type="button"
          className={mode === "upload" ? "is-active" : ""}
          onClick={() => setMode("upload")}
        >
          {t("designer.image.upload")}
        </button>
      </div>

      {mode === "url" ? (
        <input
          className="dz-prop-input"
          type="url"
          placeholder="https://…"
          value={isUpload ? "" : src}
          onChange={(e) => patch({ src: e.target.value })}
        />
      ) : (
        <div className="dz-image-upload">
          <Dropzone id={`${field.name}__img`} accept="image/*" onFile={readFile}>
            <span className="ff-dropzone-icon" aria-hidden="true">
              ⬆
            </span>
            <span className="ff-dropzone-text">
              {t("designer.image.dropzone")}
            </span>
            <span className="ff-dropzone-hint">
              {t("designer.image.dropzoneHint")}
            </span>
          </Dropzone>
        </div>
      )}

      {src && (
        <div className="dz-image-preview">
          <img src={src} alt="" />
          <button
            type="button"
            className="dz-multi-btn"
            onClick={() => patch({ src: "" })}
          >
            {t("designer.image.remove")}
          </button>
        </div>
      )}
    </div>
  );
}

function SignatureDisplaySection({
  field,
  patch,
  currentActor,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
  currentActor: CurrentActorMeta | null;
}) {
  const { t } = useTranslation("form");
  const source = field.signatureSource ?? "preset";
  const showActor =
    Boolean(currentActor?.isEmployee) || source === "currentActor";

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">
        {t("designer.signature.sourceLabel")}
      </span>
      {showActor && (
        <div className="dz-source-toggle">
          <button
            type="button"
            className={source === "preset" ? "is-active" : ""}
            onClick={() => patch({ signatureSource: "preset" })}
          >
            {t("designer.signature.sourcePreset")}
          </button>

          <button
            type="button"
            className={source === "currentActor" ? "is-active" : ""}
            onClick={() => patch({ signatureSource: "currentActor" })}
          >
            {t("designer.signature.sourceCurrentActor")}
          </button>
        </div>
      )}

      {source === "preset" && (
        <div className="dz-sign-preset">
          <p className="dz-prop-hint">{t("designer.signature.presetHint")}</p>
          <SignaturePad
            key={field.name}
            value={field.signatureValue ?? ""}
            onChange={(v) => patch({ signatureValue: v })}
            id={`${field.name}__preset`}
          />
        </div>
      )}

      {source === "currentActor" && (
        <p className="dz-prop-hint">
          {t("designer.signature.currentActorHint")}
          {currentActor?.employeeName ? ` (${currentActor.employeeName})` : ""}
        </p>
      )}
    </div>
  );
}
