import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslation } from "react-i18next";

import type { FormSchema } from "./forms/types";
import { isFormSchema } from "./forms/types";
import { useFormModel } from "./forms/designer/useFormModel";
import Palette from "./forms/designer/Palette";
import Canvas from "./forms/designer/Canvas";
import PropertyPanel, { type CurrentActorMeta } from "./forms/designer/PropertyPanel";
import PreviewTab from "./forms/designer/PreviewTab";
import LogicTab from "./forms/designer/LogicTab";
import ThemeTab from "./forms/designer/ThemeTab";
import TranslateTab from "./forms/designer/TranslateTab";
import {
  buildInitialSchema,
  downloadFile,
  messageOf,
} from "./forms/designer/starter";

import "./forms/forms.css";
import "./forms/designer/designer.css";
import "./FormEditor.css";

type FormBuilderProps = {
  actorId?: string | null;
  actorLabel?: string | null;
  // A previously saved form schema (our own JSON shape) for this actor, if any.
  existingSchema?: object | null;
  // Context about the actor this form belongs to, used to offer actor-specific
  // field options (e.g. binding a signature to the current actor).
  currentActor?: CurrentActorMeta | null;
  onSave?: (schema: object, actorLabel: string) => void;
  onClose?: () => void;
};

type TabId = "design" | "preview" | "logic" | "theme" | "translate";

export default function FormBuilder({
  actorId,
  actorLabel,
  existingSchema,
  currentActor,
  onSave,
  onClose,
}: FormBuilderProps) {
  const { t, i18n } = useTranslation("form");
  const locale = i18n.language;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabId>("design");
  const [labelInput, setLabelInput] = useState(actorLabel ?? "");
  const [savedFormData, setSavedFormData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build the starting schema once; the effect below reloads on actor switch.
  const initial = useMemo<FormSchema>(
    () =>
      existingSchema && isFormSchema(existingSchema)
        ? existingSchema
        : buildInitialSchema(t, actorId, actorLabel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const model = useFormModel(initial);

  // Reload when the editor is reused for a different actor / saved form. Skips
  // the first run since `useFormModel` already seeded from the same props.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const next =
      existingSchema && isFormSchema(existingSchema)
        ? existingSchema
        : buildInitialSchema(t, actorId, actorLabel);
    model.load(next);
    setLabelInput(actorLabel ?? "");
    setSavedFormData(null);
    setError(null);
    setTab("design");
    // `t` omitted on purpose: the starter language is fixed when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, actorLabel, existingSchema]);

  const addField = (
    type: Parameters<typeof model.addField>[0],
    title: string,
    index?: number,
  ) => model.addField(type, title, index);

  function handleNew(): void {
    model.load(buildInitialSchema(t, actorId, actorLabel));
    setSavedFormData(null);
    setError(null);
    setTab("design");
  }

  function handleExport(): void {
    try {
      downloadFile(
        "form.json",
        JSON.stringify(model.schema, null, 2),
        "application/json",
      );
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function handleSubmit(): void {
    try {
      const schema = model.schema;
      setSavedFormData(schema);
      setError(null);
      onSave?.(schema, labelInput.trim());
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleOpenFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isFormSchema(parsed)) {
        throw new Error(t("designer.unsupportedSchema"));
      }
      model.load(parsed);
      setError(null);
      setTab("design");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      event.target.value = "";
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "design", label: t("designer.tabs.design") },
    { id: "preview", label: t("designer.tabs.preview") },
    { id: "logic", label: t("designer.tabs.logic") },
    { id: "theme", label: t("designer.tabs.theme") },
    { id: "translate", label: t("designer.tabs.translate") },
  ];

  return (
    <div className="form-editor">
      <div className="form-header">
        <span>{t("headerFor", { name: labelInput || actorId || "actor" })}</span>
        {onClose && (
          <button
            type="button"
            className="form-header-close"
            aria-label={t("closeForm")}
            title={t("closeForm")}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      <div className="dz-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dz-tab${tab === item.id ? " is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="dz-body">
        {tab === "design" && (
          <div className="dz-design">
            <Palette onAdd={(type, title) => addField(type, title)} />
            <Canvas model={model} locale={locale} onAdd={addField} />
            <PropertyPanel model={model} currentActor={currentActor ?? null} />
          </div>
        )}
        {tab === "preview" && (
          <PreviewTab schema={model.schema} locale={locale} />
        )}
        {tab === "logic" && (
          <div className="dz-body-scroll">
            <LogicTab model={model} locale={locale} />
          </div>
        )}
        {tab === "theme" && (
          <div className="dz-body-scroll">
            <ThemeTab model={model} locale={locale} />
          </div>
        )}
        {tab === "translate" && (
          <div className="dz-body-scroll">
            <TranslateTab model={model} locale={locale} />
          </div>
        )}
      </div>

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
          accept=".json,application/json"
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

      {error && <div className="form-error">{t("error", { error })}</div>}
    </div>
  );
}
