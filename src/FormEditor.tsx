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
import { fetchApiList } from "./forms/fields/apiSource";
import { useFormModel } from "./forms/designer/useFormModel";
import {
  createDesignerStore,
  DesignerStoreProvider,
} from "./forms/designer/designerStore";
import Palette from "./forms/designer/Palette";
import CanvasRenderer from "./forms/designer/CanvasRenderer";
import CanvasToolbar from "./forms/designer/CanvasToolbar";
import PropertyPanel, {
  type CurrentActorMeta,
  type DesignerVariable,
} from "./forms/designer/PropertyPanel";
import PreviewTab from "./forms/designer/PreviewTab";
import LogicTab from "./forms/designer/LogicTab";
import {
  buildInitialSchema,
  downloadFile,
  messageOf,
} from "./forms/designer/starter";

import "./forms/forms.css";
import "./forms/designer/designer.css";
import "./forms/designer/canvas.css";
import "./FormEditor.css";

type FormBuilderProps = {
  actorId?: string | null;
  actorLabel?: string | null;
  // A previously saved form schema (our own JSON shape) for this actor, if any.
  existingSchema?: object | null;
  // Context about the actor this form belongs to, used to offer actor-specific
  // field options (e.g. binding a signature to the current actor).
  currentActor?: CurrentActorMeta | null;
  // Process / upstream-form variables in scope for this form, offered as
  // insertable `{name}` tokens in the dynamic-text editor.
  availableVariables?: DesignerVariable[];
  onSave?: (schema: object, actorLabel: string) => void;
  onClose?: () => void;
};

type TabId = "design" | "preview" | "logic";

// Icon for the properties toggle: a panel with a highlighted right-hand
// sidebar, echoing the properties column it shows/hides.
function PropsPanelIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <line x1="12.5" y1="3.5" x2="12.5" y2="16.5" />
    </svg>
  );
}

// Icon for the fields toggle: a panel with a highlighted left-hand sidebar,
// echoing the field palette column it shows/hides.
function FieldsPanelIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <line x1="7.5" y1="3.5" x2="7.5" y2="16.5" />
    </svg>
  );
}

export default function FormBuilder({
  actorId,
  actorLabel,
  existingSchema,
  currentActor,
  availableVariables,
  onSave,
  onClose,
}: FormBuilderProps) {
  const { t, i18n } = useTranslation("form");
  const locale = i18n.language;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabId>("design");
  // Whether the design tab's side panels are shown (toggled from the tab bar).
  const [showProps, setShowProps] = useState(true);
  const [showFields, setShowFields] = useState(true);
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
  // The designer store is created once per editor instance and shared through
  // context so the visual canvas can talk to it directly; `useFormModel` is a
  // backward-compatible view of the same store for the side tabs.
  const [storeApi] = useState(() => createDesignerStore(initial));
  const model = useFormModel(storeApi);

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
      setError(t("error", { error: messageOf(err) }));
    }
  }

  // True while the submit-time API table connection checks are running.
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    try {
      const schema = model.schema;
      // Every API-backed display table must reach its endpoint before we save:
      // a failing connection blocks save + close and reports a validation error.
      const apiTables = schema.pages
        .flatMap((page) => page.elements ?? [])
        .filter((f) => f.tableSource === "api" && f.tableApi?.url?.trim());
      if (apiTables.length) {
        setSubmitting(true);
        for (const f of apiTables) {
          try {
            await fetchApiList(f.tableApi!.url, f.tableApi!.path);
          } catch {
            setError(t("tableApiConnectionError", { field: f.name || f.id }));
            return;
          }
        }
      }
      setSavedFormData(schema);
      setError(null);
      onSave?.(schema, labelInput.trim());
      // Saving from the submit button also dismisses the designer modal.
      onClose?.();
    } catch (err) {
      setError(t("error", { error: messageOf(err) }));
    } finally {
      setSubmitting(false);
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
      setError(t("error", { error: messageOf(err) }));
    } finally {
      event.target.value = "";
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "design", label: t("designer.tabs.design") },
    { id: "preview", label: t("designer.tabs.preview") },
    { id: "logic", label: t("designer.tabs.logic") },
  ];

  return (
    <div className="form-editor">
      <div className="form-header">
        <span>{t("headerFor", { name: labelInput || actorId || "actor" })}</span>
        <div className="form-header-actions">
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
        {tab === "design" && (
          <div className="dz-tabs-tools">
            <button
              type="button"
              className={`dz-tab-toggle${showFields ? " is-active" : ""}`}
              aria-label={showFields ? t("designer.hideFields") : t("designer.showFields")}
              aria-pressed={showFields}
              title={showFields ? t("designer.hideFields") : t("designer.showFields")}
              onClick={() => setShowFields((v) => !v)}
            >
              <FieldsPanelIcon />
            </button>
            <button
              type="button"
              className={`dz-tab-toggle${showProps ? " is-active" : ""}`}
              aria-label={showProps ? t("designer.hideProps") : t("designer.showProps")}
              aria-pressed={showProps}
              title={showProps ? t("designer.hideProps") : t("designer.showProps")}
              onClick={() => setShowProps((v) => !v)}
            >
              <PropsPanelIcon />
            </button>
          </div>
        )}
      </div>

      <DesignerStoreProvider value={storeApi}>
      <div className="dz-body">
        {tab === "design" && (
          <div
            className={`dz-design${showFields ? "" : " dz-design--no-fields"}${
              showProps ? "" : " dz-design--no-props"
            }`}
          >
            {showFields && (
              <Palette onAdd={(type, title) => model.addField(type, title)} />
            )}
            <div className="dz-canvas-wrap">
              <CanvasToolbar />
              <CanvasRenderer locale={locale} />
            </div>
            {showProps && (
              <PropertyPanel
                model={model}
                currentActor={currentActor ?? null}
                availableVariables={availableVariables ?? []}
              />
            )}
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
      </div>
      </DesignerStoreProvider>

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
        <button
          type="button"
          className="form-submit"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? t("checkingConnection") : t("submit")}
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

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
