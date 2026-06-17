// The property panel: curated editors for the selected field (driven by the
// field type's `editableProps`), or form-level title/description when nothing
// is selected. Localized text is edited in the base/default language here; the
// Translate tab handles other locales.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Breakpoint,
  Choice,
  ChoicesApi,
  ColSpan,
  FormField,
  LocalizedText,
} from "../types";
import { getFieldType, type EditableProp } from "../fieldTypes";
import { getLocaleText, setLocaleText } from "../text";
import { BREAKPOINTS, COLUMN_COUNT } from "../layout";
import SignaturePad from "../fields/SignaturePad";
import type { FormModel } from "./useFormModel";

const BASE_LOCALE = "en";
const INPUT_TYPES = ["text", "email", "number", "tel", "url", "password"];
// Selectable max-height presets (px) for a checkbox options list.
const OPTIONS_MAX_HEIGHTS = [120, 160, 200, 240, 300, 400];

// Minimal info about the form's actor, used to offer actor-specific options
// (e.g. the "current actor signature" binding for a single-employee actor).
export type CurrentActorMeta = {
  isEmployee: boolean;
  employeeName?: string | null;
};

type PropertyPanelProps = {
  model: FormModel;
  currentActor?: CurrentActorMeta | null;
};

export default function PropertyPanel({
  model,
  currentActor,
}: PropertyPanelProps) {
  const { t } = useTranslation("form");
  const field = model.selectedField;

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

      {has("choices") && <ChoicesSection field={field} patch={patch} />}

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

      {has("previewSize") && (
        <>
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.signature.maxWidth")}
            </span>
            <input
              className="dz-prop-input"
              type="number"
              min={40}
              placeholder="320"
              value={field.previewMaxWidth ?? ""}
              onChange={(e) =>
                patch({
                  previewMaxWidth:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="dz-prop">
            <span className="dz-prop-label">
              {t("designer.signature.maxHeight")}
            </span>
            <input
              className="dz-prop-input"
              type="number"
              min={40}
              placeholder="160"
              value={field.previewMaxHeight ?? ""}
              onChange={(e) =>
                patch({
                  previewMaxHeight:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        </>
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

      <ColumnsEditor
        colSpan={field.colSpan}
        onChange={(colSpan) => patch({ colSpan })}
      />
    </aside>
  );
}

// Per-breakpoint width (columns out of 12). `base` defaults to full width; the
// larger breakpoints offer an "inherit" option (empty) so they fall back to the
// next smaller one.
function ColumnsEditor({
  colSpan,
  onChange,
}: {
  colSpan: ColSpan | undefined;
  onChange: (colSpan: ColSpan | undefined) => void;
}) {
  const { t } = useTranslation("form");

  const setSpan = (key: Breakpoint, value: number | undefined) => {
    const next: ColSpan = { ...(colSpan ?? {}) };
    if (value == null) delete next[key];
    else next[key] = value;
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="dz-prop">
      <span className="dz-prop-label">{t("designer.layout.columns")}</span>
      <p className="dz-prop-hint">{t("designer.layout.columnsHint")}</p>
      <div className="dz-cols">
        {BREAKPOINTS.map(({ key }) => {
          const value = colSpan?.[key];
          const isBase = key === "base";
          return (
            <label key={key} className="dz-col-row">
              <span className="dz-col-bp">
                {t(`designer.layout.bp.${key}`)}
              </span>
              <select
                className="dz-prop-input"
                value={value ?? ""}
                onChange={(e) =>
                  setSpan(
                    key,
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              >
                <option value="">
                  {isBase
                    ? t("designer.layout.full")
                    : t("designer.layout.inherit")}
                </option>
                {Array.from({ length: COLUMN_COUNT }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {t("designer.layout.ofTwelve", { n })}
                    </option>
                  ),
                )}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Editors ───────────────────────────────────────────────────────────────

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

// Display signature: choose a preset image or the current actor's signature.
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
            previewMaxWidth={field.previewMaxWidth}
            previewMaxHeight={field.previewMaxHeight}
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
