// The designer's state model. Owns the FormSchema + current selection and
// exposes immutable-update helpers; every mutation produces a new schema object
// so React re-renders normally (no external model / revision counter).

import { useCallback, useMemo, useState } from "react";
import type {
  FieldType,
  FormField,
  FormPage,
  FormSchema,
  ThemeSettings,
} from "../types";
import { getFieldType } from "../fieldTypes";

export type FormModel = {
  schema: FormSchema;
  fields: FormField[];
  selectedName: string | null;
  selectedField: FormField | null;
  addField: (type: FieldType, defaultTitle: string, index?: number) => void;
  removeField: (name: string) => void;
  moveField: (from: number, to: number) => void;
  selectField: (name: string | null) => void;
  updateField: (name: string, patch: Partial<FormField>) => void;
  // Rename a field's key; returns false (and does nothing) on collision.
  renameField: (name: string, nextName: string) => boolean;
  updateForm: (patch: Partial<Pick<FormSchema, "title" | "description">>) => void;
  setTheme: (theme: ThemeSettings) => void;
  load: (schema: FormSchema) => void;
};

function firstPage(schema: FormSchema): FormPage {
  return schema.pages[0] ?? { name: "page1", elements: [] };
}

// Generate a key not already used by another field.
function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
}

// A fresh, stable field id in Camunda's form designer (form-js) style:
// the prefix `Field_` followed by a 7-character base-36 random suffix, mirroring
// the bpmn-io `ids` convention (e.g. `Field_1a2b3c4`, like the BPMN modeler's
// `Activity_…`). The prefix keeps the id a valid XML NCName even when the
// suffix starts with a digit.
const ID_PREFIX = "Field_";
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
export function newFieldId(): string {
  let suffix = "";
  for (let i = 0; i < 7; i += 1) {
    suffix += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return ID_PREFIX + suffix;
}

// Backfill ids for any field missing one, leaving existing ids untouched. Used
// when seeding/loading a schema so every field carries an id in the JSON.
// Returns the same schema object when nothing changed.
export function ensureFieldIds(schema: FormSchema): FormSchema {
  let changed = false;
  const pages = schema.pages.map((page) => {
    let pageChanged = false;
    const elements = page.elements.map((el) => {
      if (el.id) return el;
      pageChanged = true;
      return { ...el, id: newFieldId() };
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, elements };
  });
  return changed ? { ...schema, pages } : schema;
}

export function useFormModel(initial: FormSchema): FormModel {
  const [schema, setSchema] = useState<FormSchema>(() => ensureFieldIds(initial));
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const fields = useMemo(
    () => schema.pages.flatMap((page) => page.elements),
    [schema],
  );

  // Replace page[0]'s elements via an updater, keeping the rest of the schema.
  const updateElements = useCallback(
    (updater: (elements: FormField[]) => FormField[]) => {
      setSchema((prev) => {
        const page = firstPage(prev);
        return {
          ...prev,
          pages: [{ ...page, elements: updater(page.elements) }, ...prev.pages.slice(1)],
        };
      });
    },
    [],
  );

  const addField = useCallback(
    (type: FieldType, defaultTitle: string, index?: number) => {
      const def = getFieldType(type);
      if (!def) return;
      updateElements((elements) => {
        const taken = new Set(elements.map((el) => el.name));
        const name = uniqueName(type, taken);
        const field: FormField = {
          type,
          id: newFieldId(),
          name,
          ...(def.group === "display" ? {} : { title: defaultTitle }),
          ...def.defaultProps(),
        };
        const next = [...elements];
        next.splice(index ?? next.length, 0, field);
        // Select the freshly added field for immediate editing.
        queueMicrotask(() => setSelectedName(name));
        return next;
      });
    },
    [updateElements],
  );

  const removeField = useCallback(
    (name: string) => {
      updateElements((elements) => elements.filter((el) => el.name !== name));
      setSelectedName((cur) => (cur === name ? null : cur));
    },
    [updateElements],
  );

  const moveField = useCallback(
    (from: number, to: number) => {
      updateElements((elements) => {
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= elements.length ||
          to >= elements.length
        ) {
          return elements;
        }
        const next = [...elements];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
    [updateElements],
  );

  const updateField = useCallback(
    (name: string, patch: Partial<FormField>) => {
      updateElements((elements) =>
        elements.map((el) => (el.name === name ? { ...el, ...patch } : el)),
      );
    },
    [updateElements],
  );

  const renameField = useCallback(
    (name: string, nextName: string): boolean => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === name) return trimmed === name;
      if (fields.some((el) => el.name === trimmed)) return false;
      updateElements((elements) =>
        elements.map((el) => (el.name === name ? { ...el, name: trimmed } : el)),
      );
      setSelectedName((cur) => (cur === name ? trimmed : cur));
      return true;
    },
    [fields, updateElements],
  );

  const updateForm = useCallback(
    (patch: Partial<Pick<FormSchema, "title" | "description">>) => {
      setSchema((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const setTheme = useCallback((theme: ThemeSettings) => {
    setSchema((prev) => ({ ...prev, theme }));
  }, []);

  const load = useCallback((next: FormSchema) => {
    setSchema(ensureFieldIds(next));
    setSelectedName(null);
  }, []);

  const selectField = useCallback((name: string | null) => {
    setSelectedName(name);
  }, []);

  const selectedField = useMemo(
    () => fields.find((el) => el.name === selectedName) ?? null,
    [fields, selectedName],
  );

  return {
    schema,
    fields,
    selectedName,
    selectedField,
    addField,
    removeField,
    moveField,
    selectField,
    updateField,
    renameField,
    updateForm,
    setTheme,
    load,
  };
}
