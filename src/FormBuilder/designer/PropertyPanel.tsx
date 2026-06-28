// The property panel: curated editors for the selected field (driven by the
// field type's `editableProps`), or form-level title/description when nothing
// is selected. Every localizable text shows an input per language inline, and
// any displayable text supports `{variable}` mentions: typing `{` opens a
// dropdown of in-scope process / form variables, inserted at the `{`.

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  Breakpoint,
  Choice,
  ChoicesApi,
  CssUnit,
  FormField,
  FormTitle,
  LayoutBox,
  ListApi,
  LocalizedText,
  TableApi,
} from "../types";
import { getFieldType, type EditableProp } from "../utils/fieldTypes";
import { getLocaleText, setLocaleText } from "../utils/text";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  colToPx,
  CSS_UNITS,
  pxToCol,
  pxToUnit,
  unitToPx,
  WIDTH_UNITS,
} from "../utils/units";
import { hasOwnLayout, resolveLayout, type Positioned } from "../utils/responsive";
import type { VariableRef } from "@shared/variables.ts";
import MentionInput from "@shared/MentionInput";
import type { MentionGroup } from "@shared/MentionInput";
import {
  DEFAULT_CANVAS_WIDTH,
  FIELD_GAP,
  formColumns,
  GROUP_PAD,
  PAGE_PADDING,
} from "./canvasLayout";
import SignaturePad from "../fields/SignaturePad";
import Dropzone from "../fields/Dropzone";
import ColorPicker from "@components/ColorPicker";
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
const LIST_STYLES = [
  { value: "disc", labelKey: "designer.listStyles.disc" },
  { value: "circle", labelKey: "designer.listStyles.circle" },
  { value: "square", labelKey: "designer.listStyles.square" },
  { value: "none", labelKey: "designer.listStyles.none" },
];
// Selectable max-height presets (px) for a checkbox options list.
const OPTIONS_MAX_HEIGHTS = [120, 160, 200, 240, 300, 400];

// Selectable max-height presets (px) for an ordered / unordered list body.
const LIST_MAX_HEIGHTS = [100, 150, 200, 300, 400, 500];

const LIST_FONT_WEIGHTS = [
  { value: "", labelKey: "designer.listFontWeights.default" },
  { value: "normal", labelKey: "designer.listFontWeights.normal" },
  { value: "500", labelKey: "designer.listFontWeights.medium" },
  { value: "600", labelKey: "designer.listFontWeights.semibold" },
  { value: "bold", labelKey: "designer.listFontWeights.bold" },
  { value: "800", labelKey: "designer.listFontWeights.extrabold" },
];

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

// A variable offered in the dynamic-text picker. BPM-agnostic on purpose: it's
// exactly the shared `VariableRef` base (name/ref/origin/source) — the designer
// groups and inserts by those and intentionally never reads a value `type`, so
// it stays decoupled from the BPM modeler's richer variable shapes. The host
// (App) can pass BPM `AvailableVariable[]` straight through (a structural
// superset) with no remap.
export type DesignerVariable = VariableRef;

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

  // The `{variable}` tokens offered for a given element: the form's own answer
  // fields (excluding `selfName`) plus the in-scope process / upstream-form
  // variables. Every displayable text input can splice these in.
  const varsFor = (selfName: string) => ({
    own: ownVariablesFor(model, selfName),
    external: availableVariables ?? [],
  });

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

        <LocalizedField
          label={t("designer.props.formTitle")}
          value={model.schema.title}
          variables={varsFor("")}
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
          <ColorPicker
            value={titleBox?.color}
            defaultColor="#1f2937"
            onChange={(v) => setStyle({ color: v })}
          />
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
        <LocalizedField
          label={t("designer.props.formTitle")}
          value={model.schema.title}
          variables={varsFor("")}
          onChange={(v) => model.updateForm({ title: v })}
        />
        <LocalizedField
          label={t("designer.props.formDescription")}
          multiline
          value={model.schema.description}
          variables={varsFor("")}
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
        <label className="dz-prop dz-prop-check">
          <input
            type="checkbox"
            checked={model.schema.submittable !== false}
            onChange={(e) =>
              model.updateForm({ submittable: e.target.checked ? undefined : false })
            }
          />
          <span>{t("designer.props.submittable")}</span>
        </label>
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
        {/* The id is the stable variable key referenced across forms, so it's
            read-only — editing it would break existing references. */}
        <input
          className="dz-prop-input"
          type="text"
          value={field.id ?? ""}
          readOnly
        />
      </label>

      {has("title") && (
        <LocalizedField
          label={t("designer.props.title")}
          value={field.title}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ title: v })}
        />
      )}

      {has("name") && <NameRow model={model} field={field} />}

      {has("description") && (
        <LocalizedField
          label={t("designer.props.description")}
          multiline
          value={field.description}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ description: v })}
        />
      )}

      {has("placeholder") && (
        <LocalizedField
          label={t("designer.props.placeholder")}
          value={field.placeholder}
          variables={varsFor(field.name)}
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
        <LocalizedField
          label={t("designer.props.html")}
          multiline
          value={field.html}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ html: v })}
        />
      )}

      {has("dynamicText") && (
        <LocalizedField
          label={t("designer.props.dynamicText")}
          multiline
          value={field.text}
          placeholder={t("designer.props.dynamicTextPlaceholder")}
          hint={t("designer.props.dynamicTextHint")}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ text: v })}
        />
      )}

      {has("src") && (
        <PlainVarInput
          label={t("designer.props.src")}
          type="url"
          placeholder="https://…"
          value={field.src ?? ""}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ src: v })}
        />
      )}

      {has("imageSource") && (
        <ImageSourceSection
          field={field}
          patch={patch}
          variables={varsFor(field.name)}
        />
      )}

      {has("alt") && (
        <LocalizedField
          label={t("designer.props.alt")}
          value={field.alt}
          variables={varsFor(field.name)}
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

      {has("variant") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.buttonVariant")}</span>
          <select
            className="dz-prop-input"
            value={field.variant ?? "primary"}
            onChange={(e) =>
              patch({ variant: e.target.value as FormField["variant"] })
            }
          >
            <option value="primary">{t("designer.props.buttonVariantPrimary")}</option>
            <option value="danger">{t("designer.props.buttonVariantDanger")}</option>
            <option value="success">{t("designer.props.buttonVariantSuccess")}</option>
          </select>
        </label>
      )}

      {has("url") && (
        <>
          <label className="dz-prop">
            <span className="dz-prop-label">{t("designer.props.buttonUrl")}</span>
            <input
              className="dz-prop-input"
              type="url"
              placeholder="https://"
              value={field.url ?? ""}
              onChange={(e) => patch({ url: e.target.value || undefined })}
            />
          </label>
          {field.url && (
            <label className="dz-prop">
              <span className="dz-prop-label">{t("designer.props.buttonUrlTarget")}</span>
              <select
                className="dz-prop-input"
                value={field.urlTarget ?? "_blank"}
                onChange={(e) =>
                  patch({ urlTarget: e.target.value as "_blank" | "_self" })
                }
              >
                <option value="_blank">{t("designer.props.buttonUrlTargetBlank")}</option>
                <option value="_self">{t("designer.props.buttonUrlTargetSelf")}</option>
              </select>
            </label>
          )}
        </>
      )}

      {has("closeOnClick") && !field.url && (
        <label className="dz-prop dz-prop-check">
          <input
            type="checkbox"
            checked={Boolean(field.closeOnClick)}
            onChange={(e) => patch({ closeOnClick: e.target.checked })}
          />
          <span>{t("designer.props.closeOnClick")}</span>
        </label>
      )}

      {has("assignments") && !field.url && (
        <AssignmentsEditor field={field} patch={patch} />
      )}

      {has("choices") && <ChoicesSection field={field} patch={patch} />}

      {has("table") && (
        <TableEditor field={field} patch={patch} variables={varsFor(field.name)} />
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

      {has("listTitle") && (
        <LocalizedField
          label={t("designer.props.listTitle")}
          value={field.listTitle}
          variables={varsFor(field.name)}
          onChange={(v) => patch({ listTitle: v })}
        />
      )}

      {has("listTitleColor") && <ListTitleStyleSection field={field} patch={patch} />}

      {has("listItems") && <ListItemsSection field={field} patch={patch} />}

      {has("listMaxHeight") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.listMaxHeight")}</span>
          <select
            className="dz-prop-input"
            value={field.listMaxHeight ?? ""}
            onChange={(e) =>
              patch({
                listMaxHeight: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          >
            <option value="">{t("designer.props.listMaxHeightNone")}</option>
            {LIST_MAX_HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {t("designer.props.px", { n: h })}
              </option>
            ))}
          </select>
        </label>
      )}

      {has("listStyle") && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.listStyle")}</span>
          <select
            className="dz-prop-input"
            value={field.listStyle ?? "disc"}
            onChange={(e) => patch({ listStyle: e.target.value })}
          >
            {LIST_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </label>
      )}

      {has("listStyleColor") && <ListStyleSection field={field} patch={patch} />}

      {has("headingStyle") && (
        <HeadingStyleSection field={field} patch={patch} />
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
        {!layout.autoHeight &&
          dim("height", "heightUnit", t("designer.layout.height"), heightBase, CSS_UNITS)}
        {num("zIndex", t("designer.layout.zIndex"), 0)}
      </div>
      <label className="dz-prop dz-prop-check">
        <input
          type="checkbox"
          checked={layout.autoHeight ?? true}
          onChange={(e) =>
            onChange({ autoHeight: e.target.checked ? true : undefined })
          }
        />
        <span>{t("designer.props.autoHeight")}</span>
      </label>
      {layout.autoHeight && (
        <label className="dz-prop">
          <span className="dz-prop-label">{t("designer.props.maxHeight")}</span>
          <input
            className="dz-prop-input"
            type="number"
            min={0}
            placeholder={t("designer.props.maxHeightPlaceholder")}
            value={layout.maxHeight ?? ""}
            onChange={(e) =>
              onChange({
                maxHeight: e.target.value ? Math.round(Number(e.target.value)) : undefined,
              })
            }
          />
        </label>
      )}
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

type VariableSet = { own: DesignerVariable[]; external: DesignerVariable[] };

// Group the in-scope variables for the mention dropdown: the form's own fields
// under "This form", then each upstream form's variables under that form's name,
// then the process globals under "Process". An external variable is dropped only
// when it resolves to the SAME token as an own field (e.g. a process global named
// like an own field — both bare `{name}`); the own field wins. Upstream form
// fields that merely share a key keep their distinct field-id ref, so they're
// still offered. Variables with no `origin` are treated as process variables.
function buildMentionGroups(
  variables: VariableSet,
  t: (key: string) => string,
): MentionGroup[] {
  const groups: MentionGroup[] = [];
  if (variables.own.length) {
    groups.push({
      key: "own",
      label: t("designer.props.varsThisForm"),
      vars: variables.own,
    });
  }
  const ownRefs = new Set(variables.own.map((v) => v.ref ?? v.name));
  const byForm = new Map<string, DesignerVariable[]>();
  const process: DesignerVariable[] = [];
  for (const v of variables.external) {
    if (ownRefs.has(v.ref ?? v.name)) continue;
    if (v.origin === "task") {
      const form = v.source || t("designer.props.varsForm");
      const list = byForm.get(form);
      if (list) list.push(v);
      else byForm.set(form, [v]);
    } else {
      process.push(v);
    }
  }
  for (const [form, vars] of byForm) {
    groups.push({ key: `form:${form}`, label: form, vars });
  }
  if (process.length) {
    groups.push({
      key: "process",
      label: t("designer.props.varsProcess"),
      vars: process,
    });
  }
  return groups;
}


function MentionField({
  value,
  onChange,
  variables,
  multiline,
  placeholder,
  dir,
}: {
  value: string;
  onChange: (next: string) => void;
  variables: VariableSet;
  multiline?: boolean;
  placeholder?: string;
  type?: string; // accepted for call-site compat; not used
  dir?: "auto" | "ltr" | "rtl";
}) {
  const { t } = useTranslation("form");

  const groups = useMemo((): MentionGroup[] => buildMentionGroups(variables, t), [variables, t]);

  const tokenLabels = useMemo(() => {
    const map = new Map<string, string>();
    const add = (v: DesignerVariable, label: string) => {
      const token = `{${v.ref ?? v.name}}`;
      if (!map.has(token)) map.set(token, label);
    };
    for (const v of variables.own) add(v, v.name);
    for (const v of variables.external) {
      add(v, v.origin === "task" && v.source ? `${v.source}.${v.name}` : v.name);
    }
    return map;
  }, [variables]);

  return (
    <MentionInput
      value={value}
      onChange={onChange}
      groups={groups}
      tokenLabels={tokenLabels}
      placeholder={placeholder}
      surfaceClassName="dz-prop-input dz-mention-input"
      dir={dir}
      multiline={multiline}
    />
  );
}

function LocalizedField({
  label,
  value,
  multiline,
  placeholder,
  hint,
  variables,
  onChange,
}: {
  label: string;
  value: LocalizedText | undefined;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  variables?: VariableSet;
  onChange: (value: LocalizedText) => void;
}) {
  const { t, i18n } = useTranslation("form");
  const setLocale = (lng: string, next: string) =>
    onChange(setLocaleText(value, lng, next, i18n.language));

  return (
    <div className="dz-prop dz-loc">
      <span className="dz-prop-label">{label}</span>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <div key={lng} className="dz-loc-row">
          <span className="dz-loc-lang" aria-hidden="true">
            {lng.toUpperCase()}
          </span>
          {/* With variables in scope the input supports `{` mentions; otherwise a
              plain localized input. */}
          {variables ? (
            <MentionField
              value={getLocaleText(value, lng)}
              onChange={(next) => setLocale(lng, next)}
              variables={variables}
              multiline={multiline}
              placeholder={placeholder}
              dir="auto"
            />
          ) : multiline ? (
            <textarea
              className="dz-prop-input"
              rows={3}
              dir="auto"
              placeholder={placeholder}
              value={getLocaleText(value, lng)}
              onChange={(e) => setLocale(lng, e.target.value)}
            />
          ) : (
            <input
              className="dz-prop-input"
              type="text"
              dir="auto"
              placeholder={placeholder}
              value={getLocaleText(value, lng)}
              onChange={(e) => setLocale(lng, e.target.value)}
            />
          )}
        </div>
      ))}
      {(hint || variables) && (
        <p className="dz-prop-hint">{hint ?? t("designer.props.varsMentionHint")}</p>
      )}
    </div>
  );
}

// A plain (non-localized) text input that also supports `{variable}` insertion —
// used for URL fields (image / iframe `src`), whose value isn't per-language but
// may embed a token (e.g. a per-user image path).
function PlainVarInput({
  label,
  value,
  placeholder,
  type = "text",
  variables,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  variables: VariableSet;
  onChange: (value: string) => void;
}) {
  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{label}</span>
      <MentionField
        value={value}
        onChange={onChange}
        variables={variables}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}

// Field key editor: local state committed on blur; reverts on collision.
function NameRow({ model, field }: { model: FormModel; field: FormField }) {
  const { t } = useTranslation("form");
  const [draft, setDraft] = useState(field.name);

  // Re-seed when the selected field changes.
  useEffect(() => {
    setDraft(field.name);
  }, [field.name]);

  const trimmed = draft.trim();
  // Real-time: another field already owns this key?
  const isDuplicate =
    trimmed !== field.name &&
    model.fields.some((f) => f.name === trimmed);

  const commit = () => {
    if (trimmed === field.name) return;
    if (!trimmed || isDuplicate) {
      setDraft(field.name); // Revert to last valid name on blur
      return;
    }
    model.renameField(field.name, draft);
  };

  return (
    <label className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.name")}</span>
      <input
        className={`dz-prop-input${isDuplicate ? " has-error" : ""}`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {isDuplicate && (
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

  const setText = (index: number, locale: string, text: string) => {
    onChange(
      choices.map((c, i) =>
        i === index
          ? { ...c, text: setLocaleText(c.text, locale, text) }
          : c,
      ),
    );
  };
  const setValue = (index: number, value: string) => {
    onChange(
      choices.map((c, i) => (i === index ? { ...c, value } : c)),
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
        {choices.map((choice, index) => {
          const duplicate =
            choice.value.trim() !== "" &&
            choices.some((c, i) => i !== index && c.value === choice.value);
          return (
          <div key={index} className="dz-choice-row">
            <input
              className="dz-prop-input dz-choice-value"
              type="text"
              value={choice.value}
              placeholder={t("designer.props.optionValue")}
              title={t("designer.props.optionValue")}
              aria-invalid={duplicate}
              onChange={(e) => setValue(index, e.target.value)}
            />
            {/* One text input per language, so option labels translate inline. */}
            <div className="dz-choice-texts">
              {SUPPORTED_LANGUAGES.map((lng) => (
                <div key={lng} className="dz-loc-row">
                  <span className="dz-loc-lang" aria-hidden="true">
                    {lng.toUpperCase()}
                  </span>
                  <input
                    className="dz-prop-input"
                    type="text"
                    dir="auto"
                    value={getLocaleText(choice.text, lng)}
                    placeholder={t("designer.props.optionText")}
                    title={t("designer.props.optionText")}
                    onChange={(e) => setText(index, lng, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="dz-choice-remove"
              aria-label={t("designer.props.removeChoice")}
              onClick={() => remove(index)}
            >
              ✕
            </button>
          </div>
          );
        })}
      </div>
      <button type="button" className="dz-choice-add" onClick={add}>
        + {t("designer.props.addChoice")}
      </button>
    </div>
  );
}

// ── Button variable-assignment editor ────────────────────────────────────
// A small list editor: each row is a variable name + value pair with a delete
// button; an "Add" button appends a blank row.
function AssignmentsEditor({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  const assignments = field.assignments ?? [];

  const update = (index: number, key: "variable" | "value", val: string) => {
    const next = assignments.map((a, i) =>
      i === index ? { ...a, [key]: val } : a,
    );
    patch({ assignments: next });
  };

  const remove = (index: number) => {
    patch({ assignments: assignments.filter((_, i) => i !== index) });
  };

  const add = () => {
    patch({ assignments: [...assignments, { variable: "", value: "" }] });
  };

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.assignments")}</span>
      {assignments.map((a, i) => (
        <div key={i} className="dz-assignment-row">
          <input
            className="dz-prop-input"
            placeholder={t("designer.props.assignmentVariable")}
            value={a.variable}
            onChange={(e) => update(i, "variable", e.target.value)}
          />
          <input
            className="dz-prop-input"
            placeholder={t("designer.props.assignmentValue")}
            value={a.value}
            onChange={(e) => update(i, "value", e.target.value)}
          />
          <button
            type="button"
            className="dz-choice-del"
            aria-label={t("designer.props.removeAssignment")}
            onClick={() => remove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="dz-add-btn" onClick={add}>
        + {t("designer.props.addAssignment")}
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
  variables,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
  variables: VariableSet;
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

  const setHeader = (index: number, locale: string, text: string) =>
    patch({
      tableColumns: columns.map((c, i) =>
        i === index ? setLocaleText(c, locale, text) : c,
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
            {/* One header input per language, so column titles translate inline. */}
            <div className="dz-table-cell">
              {SUPPORTED_LANGUAGES.map((lng) => (
                <div key={lng} className="dz-loc-row">
                  <span className="dz-loc-lang" aria-hidden="true">
                    {lng.toUpperCase()}
                  </span>
                  <MentionField
                    value={getLocaleText(col, lng)}
                    onChange={(next) => setHeader(i, lng, next)}
                    variables={variables}
                    placeholder={t("designer.table.headerPlaceholder")}
                    dir="auto"
                  />
                </div>
              ))}
            </div>
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
            variables={variables}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableRows: rows })}
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
            variables={variables}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableTopRows: rows })}
          />
          <span className="dz-prop-sublabel">
            {t("designer.table.bottomRows")}
          </span>
          <TableRowsEditor
            rows={field.tableBottomRows ?? []}
            colCount={colCount}
            variables={variables}
            addLabel={t("designer.table.addRow")}
            removeLabel={t("designer.table.removeRow")}
            onChange={(rows) => patch({ tableBottomRows: rows })}
          />
        </>
      )}

      <p className="dz-prop-hint">{t("designer.table.variableHint")}</p>
    </div>
  );
}

// Editor for one set of manual table rows (the body, or an API table's top /
// bottom rows). Each row has one cell input per column, aligned to `colCount`,
// plus a remove button; an add button appends an empty row.
function TableRowsEditor({
  rows,
  colCount,
  variables,
  addLabel,
  removeLabel,
  onChange,
}: {
  rows: LocalizedText[][];
  colCount: number;
  // In-scope variables, so each cell supports `{` mention insertion.
  variables: VariableSet;
  addLabel: string;
  removeLabel: string;
  onChange: (rows: LocalizedText[][]) => void;
}) {
  const setCell = (r: number, c: number, locale: string, text: string) =>
    onChange(
      rows.map((row, ri) =>
        ri === r
          ? Array.from({ length: colCount }, (_, ci) =>
              ci === c
                ? setLocaleText(row[ci], locale, text)
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
              // One input per language for each cell, so body text translates inline.
              <div key={c} className="dz-table-cell">
                {SUPPORTED_LANGUAGES.map((lng) => (
                  <div key={lng} className="dz-loc-row">
                    <span className="dz-loc-lang" aria-hidden="true">
                      {lng.toUpperCase()}
                    </span>
                    <MentionField
                      value={getLocaleText(row[c], lng)}
                      onChange={(next) => setCell(r, c, lng, next)}
                      variables={variables}
                      dir="auto"
                    />
                  </div>
                ))}
              </div>
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
  variables,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
  variables: VariableSet;
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
        <MentionField
          value={isUpload ? "" : src}
          onChange={(next) => patch({ src: next })}
          variables={variables}
          type="url"
          placeholder="https://…"
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

// Manual list items editor — used when source === "manual".
function ListItemsManualEditor({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  const items = field.listItems ?? [];

  const setText = (index: number, locale: string, text: string) =>
    patch({
      listItems: items.map((item, i) =>
        i === index ? setLocaleText(item, locale, text) : item,
      ),
    });
  const remove = (index: number) =>
    patch({ listItems: items.filter((_, i) => i !== index) });
  const add = () =>
    patch({
      listItems: [...items, { default: `Item ${items.length + 1}` }],
    });

  return (
    <>
      <div className="dz-choices">
        {items.map((item, index) => (
          <div key={index} className="dz-choice-row">
            <div className="dz-choice-texts">
              {SUPPORTED_LANGUAGES.map((lng) => (
                <div key={lng} className="dz-loc-row">
                  <span className="dz-loc-lang" aria-hidden="true">
                    {lng.toUpperCase()}
                  </span>
                  <input
                    className="dz-prop-input"
                    type="text"
                    dir="auto"
                    value={getLocaleText(item, lng)}
                    placeholder={t("designer.props.listItem")}
                    onChange={(e) => setText(index, lng, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="dz-choice-remove"
              aria-label={t("designer.props.removeListItem")}
              onClick={() => remove(index)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="dz-choice-add" onClick={add}>
        + {t("designer.props.addListItem")}
      </button>
    </>
  );
}

// Items source for a list field: a hand-entered list, or a remote API mapped
// via an optional display key.
function ListItemsSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  const source = field.listItemsSource ?? "manual";
  const api: ListApi = field.listItemsApi ?? { url: "", path: "" };
  const setApi = (p: Partial<ListApi>) =>
    patch({ listItemsApi: { ...api, ...p } });

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.props.listItems")}</span>

      <div className="dz-source-toggle">
        <button
          type="button"
          className={source === "manual" ? "is-active" : ""}
          onClick={() => patch({ listItemsSource: "manual" })}
        >
          {t("designer.choicesApi.manual")}
        </button>
        <button
          type="button"
          className={source === "api" ? "is-active" : ""}
          onClick={() => patch({ listItemsSource: "api", listItemsApi: api })}
        >
          {t("designer.choicesApi.api")}
        </button>
      </div>

      {source === "manual" ? (
        <ListItemsManualEditor field={field} patch={patch} />
      ) : (
        <div className="dz-api">
          <label className="dz-prop">
            <span className="dz-prop-label">{t("designer.choicesApi.url")}</span>
            <input
              className="dz-prop-input"
              type="url"
              placeholder="https://api.example.com/items"
              value={api.url}
              onChange={(e) => setApi({ url: e.target.value })}
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">{t("designer.choicesApi.path")}</span>
            <input
              className="dz-prop-input"
              type="text"
              placeholder="data.items"
              value={api.path ?? ""}
              onChange={(e) => setApi({ path: e.target.value })}
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
              value={api.displayKey ?? ""}
              onChange={(e) =>
                setApi({ displayKey: e.target.value || undefined })
              }
            />
          </label>
          <p className="dz-prop-hint">{t("designer.listItemsApi.hint")}</p>
        </div>
      )}
    </div>
  );
}

function ListTitleStyleSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");
  return (
    <>
      <div className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listTitleColor")}</span>
        <ColorPicker
          value={field.listTitleColor}
          defaultColor="#1f2937"
          onChange={(v) => patch({ listTitleColor: v })}
        />
      </div>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listTitleFontSize")}</span>
        <input
          className="dz-prop-input"
          type="number"
          min={8}
          max={120}
          placeholder="16"
          value={field.listTitleFontSize ?? ""}
          onChange={(e) =>
            patch({ listTitleFontSize: e.target.value === "" ? undefined : Number(e.target.value) })
          }
        />
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listTitleFontWeight")}</span>
        <select
          className="dz-prop-input"
          value={field.listTitleFontWeight ?? ""}
          onChange={(e) => patch({ listTitleFontWeight: e.target.value || undefined })}
        >
          {LIST_FONT_WEIGHTS.map((fw) => (
            <option key={fw.value} value={fw.value}>{t(fw.labelKey)}</option>
          ))}
        </select>
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listTitleFontFamily")}</span>
        <select
          className="dz-prop-input"
          value={field.listTitleFontFamily ?? ""}
          onChange={(e) => patch({ listTitleFontFamily: e.target.value || undefined })}
        >
          {TITLE_FONT_FAMILIES.map((f) => (
            <option key={f.labelKey} value={f.value}>{t(f.labelKey)}</option>
          ))}
        </select>
      </label>
    </>
  );
}

function ListStyleSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");

  return (
    <>
      <span className="dz-prop-sublabel">{t("designer.props.listItemsStyle")}</span>

      <div className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listTextColor")}</span>
        <ColorPicker
          value={field.listTextColor}
          onChange={(v) => patch({ listTextColor: v })}
        />
      </div>

      <div className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listStyleColor")}</span>
        <ColorPicker
          value={field.listStyleColor}
          onChange={(v) => patch({ listStyleColor: v })}
        />
      </div>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listFontSize")}</span>
        <input
          className="dz-prop-input"
          type="number"
          min={8}
          max={120}
          placeholder="14"
          value={field.listFontSize ?? ""}
          onChange={(e) =>
            patch({ listFontSize: e.target.value === "" ? undefined : Number(e.target.value) })
          }
        />
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listFontWeight")}</span>
        <select
          className="dz-prop-input"
          value={field.listFontWeight ?? ""}
          onChange={(e) => patch({ listFontWeight: e.target.value || undefined })}
        >
          {LIST_FONT_WEIGHTS.map((fw) => (
            <option key={fw.value} value={fw.value}>{t(fw.labelKey)}</option>
          ))}
        </select>
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.listFontFamily")}</span>
        <select
          className="dz-prop-input"
          value={field.listFontFamily ?? ""}
          onChange={(e) => patch({ listFontFamily: e.target.value || undefined })}
        >
          {TITLE_FONT_FAMILIES.map((f) => (
            <option key={f.labelKey} value={f.value}>{t(f.labelKey)}</option>
          ))}
        </select>
      </label>

    </>
  );
}

const HEADING_LEVELS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
const HEADING_TEXT_ALIGNS: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "designer.props.headingAlignDefault" },
  { value: "left", labelKey: "designer.props.headingAlignLeft" },
  { value: "center", labelKey: "designer.props.headingAlignCenter" },
  { value: "right", labelKey: "designer.props.headingAlignRight" },
];

function HeadingStyleSection({
  field,
  patch,
}: {
  field: FormField;
  patch: (p: Partial<FormField>) => void;
}) {
  const { t } = useTranslation("form");

  return (
    <>
      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingLevel")}</span>
        <select
          className="dz-prop-input"
          value={field.headingLevel ?? "h2"}
          onChange={(e) =>
            patch({ headingLevel: e.target.value as FormField["headingLevel"] })
          }
        >
          {HEADING_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <div className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingTextColor")}</span>
        <ColorPicker
          value={field.headingTextColor}
          defaultColor="#1f2937"
          onChange={(v) => patch({ headingTextColor: v })}
        />
      </div>

      <div className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingBgColor")}</span>
        <ColorPicker
          value={field.headingBgColor}
          defaultColor="#ffffff"
          onChange={(v) => patch({ headingBgColor: v })}
        />
      </div>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingFontSize")}</span>
        <input
          className="dz-prop-input"
          type="number"
          min={8}
          max={120}
          placeholder="24"
          value={field.headingFontSize ?? ""}
          onChange={(e) =>
            patch({
              headingFontSize:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        />
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingFontWeight")}</span>
        <select
          className="dz-prop-input"
          value={field.headingFontWeight ?? ""}
          onChange={(e) => patch({ headingFontWeight: e.target.value || undefined })}
        >
          {LIST_FONT_WEIGHTS.map((fw) => (
            <option key={fw.value} value={fw.value}>
              {t(fw.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="dz-prop dz-prop-check">
        <input
          type="checkbox"
          checked={field.headingFontStyle === "italic"}
          onChange={(e) =>
            patch({ headingFontStyle: e.target.checked ? "italic" : undefined })
          }
        />
        <span>{t("designer.props.headingFontItalic")}</span>
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingFontFamily")}</span>
        <select
          className="dz-prop-input"
          value={field.headingFontFamily ?? ""}
          onChange={(e) => patch({ headingFontFamily: e.target.value || undefined })}
        >
          {TITLE_FONT_FAMILIES.map((f) => (
            <option key={f.labelKey} value={f.value}>
              {t(f.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <label className="dz-prop">
        <span className="dz-prop-label">{t("designer.props.headingTextAlign")}</span>
        <select
          className="dz-prop-input"
          value={field.headingTextAlign ?? ""}
          onChange={(e) =>
            patch({
              headingTextAlign:
                (e.target.value as FormField["headingTextAlign"]) || undefined,
            })
          }
        >
          {HEADING_TEXT_ALIGNS.map((a) => (
            <option key={a.value} value={a.value}>
              {t(a.labelKey)}
            </option>
          ))}
        </select>
      </label>
    </>
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
