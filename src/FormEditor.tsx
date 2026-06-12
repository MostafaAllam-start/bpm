import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { FormEditor } from "@bpmn-io/form-js-editor";

// form-js editor styles (includes the live form preview + the editor chrome)
// and the properties panel on the right.
import "@bpmn-io/form-js-editor/dist/assets/form-js-editor.css";
import "@bpmn-io/form-js-editor/dist/assets/properties-panel.css";
// The date/time field uses flatpickr, whose calendar CSS ships with the viewer
// (not the editor) — without it the calendar grid renders unstyled/broken.
import "@bpmn-io/form-js-viewer/dist/assets/flatpickr/light.css";

import { installFormEditorI18n } from "./i18n/formEditorTranslations";
import "./FormEditor.css";

// A starter form schema (the same JSON shape as a bpmn.io `form.json`). Drag
// fields from the palette on the left, edit them via the panel on the right.
type FormBuilderProps = {
  actorId?: string | null;
  actorLabel?: string | null;
  existingSchema?: object | null;
  onSave?: (schema: object, actorLabel: string) => void;
};

// The starter schema is the same regardless of language; only the user-facing
// text/labels are translated. `t` is the "form" namespace translator.
type Translate = TFunction;

const SCHEMA_VERSION = 19;
const DEFAULT_FORM_ID = "Form_example";

// The field components shared by every starter schema; only the heading text
// differs between "blank" and "for actor X".
function buildComponents(t: Translate, titleText: string) {
  return [
    { type: "text", text: titleText, id: "Field_title" },
    {
      type: "textfield",
      key: "name",
      label: t("defaults.name"),
      id: "Field_name",
    },
    {
      type: "textfield",
      key: "email",
      label: t("defaults.email"),
      id: "Field_email",
    },
    {
      type: "checkbox",
      key: "subscribe",
      label: t("defaults.subscribe"),
      id: "Field_subscribe",
    },
    {
      type: "button",
      action: "submit",
      label: t("defaults.submit"),
      id: "Field_submit",
    },
  ];
}

function buildInitialForm(t: Translate) {
  return {
    type: "default",
    id: DEFAULT_FORM_ID,
    schemaVersion: SCHEMA_VERSION,
    components: buildComponents(t, `# ${t("defaults.contactTitle")}`),
  };
}

function buildFormSchema(
  t: Translate,
  actorId?: string | null,
  actorLabel?: string | null,
) {
  const name = actorLabel || actorId;
  const titleText = name
    ? `# ${t("headerFor", { name })}`
    : `# ${t("defaults.contactTitle")}`;
  return {
    type: "default",
    id: actorId ? `Form_${actorId}` : DEFAULT_FORM_ID,
    schemaVersion: SCHEMA_VERSION,
    components: buildComponents(t, titleText),
  };
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function applyActorLabelToSchema(
  schema: any,
  actorLabel: string | null | undefined,
  t: Translate,
) {
  if (!actorLabel || !schema || !Array.isArray(schema.components)) {
    return schema;
  }

  const firstComponent = schema.components[0];
  if (firstComponent?.type !== "text") {
    return schema;
  }

  return {
    ...schema,
    components: [
      {
        ...firstComponent,
        text: `# ${t("headerFor", { name: actorLabel })}`,
      },
      ...schema.components.slice(1),
    ],
  };
}

function downloadFile(name: string, data: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FormBuilder({
  actorId,
  actorLabel,
  existingSchema,
  onSave,
}: FormBuilderProps) {
  const { t } = useTranslation("form");
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<FormEditor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFormData, setSavedFormData] = useState<object | null>(null);
  // Editable actor label. Seeded from the prop and kept in sync when the editor
  // is reused for a different actor; saved back alongside the schema.
  const [labelInput, setLabelInput] = useState(actorLabel ?? "");

  const hidePoweredBy = (): void => {
    const list = document.querySelectorAll(".fjs-powered-by-link");
    list.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.display = "none";
      }
    });
  };

  useEffect(() => {
    const container = containerRef.current!;
    const editor = new FormEditor({ container });
    editorRef.current = editor;

    // form-js hardcodes its palette / properties-panel chrome in English, so we
    // translate that DOM in place (scoped to the chrome, not the form preview)
    // and keep it in sync with the app language.
    const removeFormI18n = installFormEditorI18n(container);

    // form-js opens the date picker on input *focus* (it sets clickOpens:false),
    // so clicking the calendar icon doesn't reliably pop the calendar. Open the
    // flatpickr instance explicitly on any click inside a date field's control.
    const openDatePickerOnClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const group = target?.closest?.(
        ".fjs-form-field-datetime .fjs-input-group",
      );
      const input = group?.querySelector<
        HTMLInputElement & { _flatpickr?: { open: () => void } }
      >("input.fjs-input");
      input?._flatpickr?.open?.();
    };
    container.addEventListener("click", openDatePickerOnClick);

    // StrictMode double-mount guard (see BpmnModeler for the rationale): the
    // async import must not touch an editor that cleanup already destroyed.
    let active = true;
    const schema = existingSchema
      ? applyActorLabelToSchema(existingSchema, actorLabel, t)
      : buildFormSchema(t, actorId, actorLabel);

    const imported = editor.importSchema(schema).catch((err: unknown) => {
      if (active) setError(messageOf(err));
    });

    imported.then(() => {
      if (active) {
        hidePoweredBy();
      }
    });

    return () => {
      active = false;
      removeFormI18n();
      container.removeEventListener("click", openDatePickerOnClick);
      imported.finally(() => editor.destroy());
    };
    // Build the starter schema once on mount. We deliberately don't re-run on
    // `t`/prop changes here — switching language mid-edit must not wipe the
    // user's work; the effect below handles actor/schema swaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const schema = existingSchema
      ? applyActorLabelToSchema(existingSchema, actorLabel, t)
      : buildFormSchema(t, actorId, actorLabel);
    editor
      .importSchema(schema)
      .then(() => {
        hidePoweredBy();
      })
      .catch((err: unknown) => {
        setError(messageOf(err));
      });
    setSavedFormData(null);
    setLabelInput(actorLabel ?? "");
    // `t` is intentionally omitted: the starter schema's language is fixed when
    // the form opens, so a language switch doesn't reset in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, actorLabel, existingSchema]);

  // Export the current form as a `form.json` schema file.
  function handleExport(): void {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const schema = editor.saveSchema();
      downloadFile(
        "form.json",
        JSON.stringify(schema, null, 2),
        "application/json",
      );
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleNew(): Promise<void> {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await editor.importSchema(buildInitialForm(t));
      setError(null);
      setSavedFormData(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleSubmit(): Promise<void> {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const schema = editor.saveSchema();
      setSavedFormData(schema);
      setError(null);
      onSave?.(schema, labelInput.trim());
      console.log("Saved form data:", schema);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  // Load a form schema (.json / .form) the user picks from disk.
  async function handleOpenFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const editor = editorRef.current;
    const file = event.target.files?.[0];
    if (!editor || !file) return;
    try {
      const schema = JSON.parse(await file.text());
      await editor.importSchema(schema);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="form-editor">
      <div className="form-header">
        <span>{t("headerFor", { name: labelInput || actorId || "actor" })}</span>
        <label className="form-actor-label">
          {t("actorLabel")}
          <input
            type="text"
            value={labelInput}
            placeholder={t("actorLabelPlaceholder")}
            onChange={(event) => setLabelInput(event.target.value)}
          />
        </label>
      </div>

      <div ref={containerRef} className="form-canvas" />

      <div className="form-footer">
        <button type="button" onClick={handleNew}>
          {t("new")}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {t("open")}
        </button>
        <button type="button" onClick={handleExport}>
          {t("downloadJson")}
        </button>
        <button type="button" className="form-submit" onClick={handleSubmit}>
          {t("submit")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.form,application/json"
          onChange={handleOpenFile}
          hidden
        />
      </div>

      {savedFormData && (
        <div className="form-saved-data">
          <h3>{t("savedData")}</h3>
          <pre>{JSON.stringify(savedFormData, null, 2)}</pre>
        </div>
      )}

      {error && (
        <div className="form-error">{t("error", { error })}</div>
      )}
    </div>
  );
}
