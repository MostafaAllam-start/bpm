import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FormEditor } from "@bpmn-io/form-js-editor";

// form-js editor styles (includes the live form preview + the editor chrome)
// and the properties panel on the right.
import "@bpmn-io/form-js-editor/dist/assets/form-js-editor.css";
import "@bpmn-io/form-js-editor/dist/assets/properties-panel.css";

import "./FormEditor.css";

// A starter form schema (the same JSON shape as a bpmn.io `form.json`). Drag
// fields from the palette on the left, edit them via the panel on the right.
type FormBuilderProps = {
  actorId?: string | null;
  actorLabel?: string | null;
  existingSchema?: object | null;
  onSave?: (schema: object, actorLabel: string) => void;
};

const INITIAL_FORM = {
  type: "default",
  id: "Form_example",
  schemaVersion: 19,
  components: [
    { type: "text", text: "# Contact form", id: "Field_title" },
    { type: "textfield", key: "name", label: "Name", id: "Field_name" },
    { type: "textfield", key: "email", label: "Email", id: "Field_email" },
    {
      type: "checkbox",
      key: "subscribe",
      label: "Subscribe to the newsletter",
      id: "Field_subscribe",
    },
    { type: "button", action: "submit", label: "Submit", id: "Field_submit" },
  ],
} as const;

function buildFormSchema(actorId?: string | null, actorLabel?: string | null) {
  return {
    type: "default",
    id: actorId ? `Form_${actorId}` : INITIAL_FORM.id,
    schemaVersion: INITIAL_FORM.schemaVersion,
    components: [
      {
        type: "text",
        text: actorLabel
          ? `# Form for ${actorLabel}`
          : actorId
            ? `# Form for ${actorId}`
            : "# Contact form",
        id: "Field_title",
      },
      { type: "textfield", key: "name", label: "Name", id: "Field_name" },
      { type: "textfield", key: "email", label: "Email", id: "Field_email" },
      {
        type: "checkbox",
        key: "subscribe",
        label: "Subscribe to the newsletter",
        id: "Field_subscribe",
      },
      { type: "button", action: "submit", label: "Submit", id: "Field_submit" },
    ],
  };
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function applyActorLabelToSchema(schema: any, actorLabel?: string | null) {
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
        text: `# Form for ${actorLabel}`,
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
    const editor = new FormEditor({ container: containerRef.current! });
    editorRef.current = editor;

    // StrictMode double-mount guard (see BpmnModeler for the rationale): the
    // async import must not touch an editor that cleanup already destroyed.
    let active = true;
    const schema = existingSchema
      ? applyActorLabelToSchema(existingSchema, actorLabel)
      : buildFormSchema(actorId, actorLabel);

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
      imported.finally(() => editor.destroy());
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const schema = existingSchema
      ? applyActorLabelToSchema(existingSchema, actorLabel)
      : buildFormSchema(actorId, actorLabel);
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
      await editor.importSchema(INITIAL_FORM);
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
        <span>Form for {labelInput || actorId || "actor"}</span>
        <label className="form-actor-label">
          Actor label
          <input
            type="text"
            value={labelInput}
            placeholder="Enter actor label…"
            onChange={(event) => setLabelInput(event.target.value)}
          />
        </label>
      </div>

      <div ref={containerRef} className="form-canvas" />

      <div className="form-footer">
        <button type="button" onClick={handleNew}>
          New
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Open…
        </button>
        <button type="button" onClick={handleExport}>
          Download form.json
        </button>
        <button type="button" className="form-submit" onClick={handleSubmit}>
          Submit
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
          <h3>Saved form data</h3>
          <pre>{JSON.stringify(savedFormData, null, 2)}</pre>
        </div>
      )}

      {error && (
        <div className="form-error">Failed to render form: {error}</div>
      )}
    </div>
  );
}
