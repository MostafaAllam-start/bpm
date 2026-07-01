// Stable field identifiers and key generation, factored out so both the
// designer store and the useFormModel adapter can use them without a cycle.

import type { FormField, FormSchema } from "../types";

// A fresh, stable field id in Camunda's form designer (form-js) style: the
// prefix `Field_` followed by a 7-character base-36 random suffix, mirroring the
// bpmn-io `ids` convention (e.g. `Field_1a2b3c4`). The prefix keeps the id a
// valid XML NCName even when the suffix starts with a digit.
const ID_PREFIX = "Field_";
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newFieldId(): string {
  let suffix = "";
  for (let i = 0; i < 7; i += 1) {
    suffix += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return ID_PREFIX + suffix;
}

// Generate a key not already used by another field.
export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}${i}`)) i += 1;
  return `${base}${i}`;
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
      return { ...el, id: newFieldId() } as FormField;
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, elements };
  });
  return changed ? { ...schema, pages } : schema;
}
