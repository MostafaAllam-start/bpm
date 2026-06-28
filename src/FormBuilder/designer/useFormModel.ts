// A thin, backward-compatible view over the designer store. The store
// (designerStore.ts) is the single source of truth; this hook exposes the
// long-standing `FormModel` shape the side tabs (Logic / Theme / Translate /
// Property panel) were written against, so they keep working unchanged while the
// new visual canvas talks to the store directly.
//
// The id helpers live in ./ids now; they're re-exported here because existing
// imports reference them from this module.

import { useMemo } from "react";
import { useStore } from "zustand";
import type {
  FieldType,
  FormField,
  FormSchema,
  LayoutBox,
  ThemeSettings,
} from "../types";
import type { DesignerStoreApi } from "./designerStore";

export { newFieldId, ensureFieldIds } from "./ids";

export type FormModel = {
  schema: FormSchema;
  fields: FormField[];
  // The primary selection (last selected), preserved for single-select callers.
  selectedName: string | null;
  // The full multi-selection (names). New; additive to the old contract.
  selectedNames: string[];
  selectedField: FormField | null;
  addField: (
    type: FieldType,
    defaultTitle: string,
    at?: { x: number; y: number },
  ) => void;
  removeField: (name: string) => void;
  moveField: (from: number, to: number) => void;
  selectField: (name: string | null) => void;
  updateField: (name: string, patch: Partial<FormField>) => void;
  // Patch a field's absolute layout box (visual designer).
  updateLayout: (name: string, patch: Partial<LayoutBox>) => void;
  // Rename a field's key; returns false (and does nothing) on collision.
  renameField: (name: string, nextName: string) => boolean;
  updateForm: (patch: Partial<Pick<FormSchema, "title" | "description" | "submittable">>) => void;
  setTheme: (theme: ThemeSettings) => void;
  load: (schema: FormSchema) => void;
};

export function useFormModel(store: DesignerStoreApi): FormModel {
  const schema = useStore(store, (s) => s.schema);
  const selection = useStore(store, (s) => s.selection);

  const fields = useMemo(
    () => schema.pages.flatMap((page) => page.elements),
    [schema],
  );
  const selectedName =
    selection.length > 0 ? selection[selection.length - 1] : null;
  const selectedField = useMemo(
    () => fields.find((el) => el.name === selectedName) ?? null,
    [fields, selectedName],
  );

  // Store actions are stable for the store's lifetime, so reading them once per
  // render (rather than subscribing) is fine and avoids needless re-renders.
  const s = store.getState();

  return {
    schema,
    fields,
    selectedName,
    selectedNames: selection,
    selectedField,
    addField: s.addField,
    removeField: s.removeField,
    moveField: s.moveField,
    selectField: s.select,
    updateField: s.updateField,
    updateLayout: s.updateLayout,
    renameField: s.renameField,
    updateForm: s.updateForm,
    setTheme: s.setTheme,
    load: s.load,
  };
}
