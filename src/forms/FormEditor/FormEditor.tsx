import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslation } from "react-i18next";

import type { FormSchema } from "../types";
import { isFormSchema } from "../types";
import { fetchApiList } from "../fields/apiSource";
import { findDuplicateFieldKeys } from "../utils/validation";
import { useFormModel } from "../designer/useFormModel";
import {
  createDesignerStore,
  DesignerStoreProvider,
} from "../designer/designerStore";
import Palette from "../designer/Palette";
import CanvasRenderer from "../designer/CanvasRenderer";
import CanvasToolbar from "../designer/CanvasToolbar";
import PropertyPanel, {
  type CurrentActorMeta,
  type DesignerVariable,
} from "../designer/PropertyPanel";
import PreviewTab from "../designer/PreviewTab";
import LogicTab from "../designer/LogicTab";
import {
  buildInitialSchema,
  downloadFile,
  messageOf,
} from "../designer/starter";

import "../forms.css";
import "../designer/designer.css";
import "../designer/canvas.css";
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
  // Whether the modal fills the whole window, and a toggle for it. When
  // `onToggleMaximize` is provided the header shows a maximize / restore button.
  maximized?: boolean;
  onToggleMaximize?: () => void;
};

type TabId = "design" | "preview" | "logic";

// Header icon: expand the modal to fill the window (arrows pointing to corners).
function MaximizeIcon(): React.ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

// Header icon: restore the modal to its windowed size (arrows pointing inward).
function RestoreIcon(): React.ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3v1.5A1.5 1.5 0 0 1 4.5 6H3M18 3v1.5A1.5 1.5 0 0 0 19.5 6H21M18 21v-1.5a1.5 1.5 0 0 1 1.5-1.5H21M6 21v-1.5A1.5 1.5 0 0 0 4.5 18H3" />
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
  maximized,
  onToggleMaximize,
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
      // Field keys must be unique within the form, so every `{variable}` reference
      // resolves unambiguously — block save and name the offenders if not.
      const dupKeys = findDuplicateFieldKeys(schema);
      if (dupKeys.length) {
        setError(t("duplicateKeys", { keys: dupKeys.join(", ") }));
        return;
      }
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
          {onToggleMaximize && (
            <button
              type="button"
              className="form-header-action"
              aria-label={maximized ? t("restoreForm") : t("maximizeForm")}
              aria-pressed={maximized}
              title={maximized ? t("restoreForm") : t("maximizeForm")}
              onClick={onToggleMaximize}
            >
              {maximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
          )}
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
      </div>

      <DesignerStoreProvider value={storeApi}>
      {tab === "design" && (
        <CanvasToolbar
          showFields={showFields}
          onToggleFields={() => setShowFields((v) => !v)}
          showProps={showProps}
          onToggleProps={() => setShowProps((v) => !v)}
        />
      )}
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
