// Field validation for the renderer. Returns a map of field name → error code;
// the renderer translates the code via i18n. Pure and dependency-free.

import type { FormField, FormSchema, FormValues } from "../types";
import { evaluateExpression } from "./conditions";
import { getFieldType } from "./fieldTypes";

export type ErrorCode = "required" | "email" | "number" | "url";

export type ValidationErrors = Record<string, ErrorCode>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s.]+\.\S+$/;

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// Whether a field is effectively required given static `isRequired` and any
// `requiredIf` expression against the current answers.
export function isFieldRequired(
  field: FormField,
  values: FormValues,
): boolean {
  // A signature that isn't user-filled (a designer preset, or the current
  // actor's signature) is supplied automatically — never required of the user.
  if (
    field.type === "signature" &&
    field.signatureSource &&
    field.signatureSource !== "user"
  ) {
    return false;
  }
  if (field.isRequired) return true;
  if (field.requiredIf) return evaluateExpression(field.requiredIf, values);
  return false;
}

// Validate one field's value; null when OK.
export function validateField(
  field: FormField,
  values: FormValues,
): ErrorCode | null {
  // Display blocks (html / image / iframe) carry no answer.
  if (getFieldType(field.type)?.group === "display") return null;

  const value = values[field.name];

  if (isFieldRequired(field, values) && isEmpty(value)) {
    return "required";
  }
  // Don't type-check empty optional fields.
  if (isEmpty(value)) return null;

  if (field.type === "email" || field.inputType === "email") {
    if (!EMAIL_RE.test(String(value))) return "email";
  }
  if (field.type === "number" || field.inputType === "number") {
    if (Number.isNaN(Number(value))) return "number";
  }
  if (field.inputType === "url") {
    if (!URL_RE.test(String(value))) return "url";
  }
  return null;
}

// Field keys (`name`) used by more than one field across the whole schema. Keys
// must be unique within a form so a `{variable}` reference — and the
// `TaskName.fieldKey` label shown when picking one — is unambiguous. The designer
// blocks collisions interactively; this is the save-time safety net (and catches
// imported schemas).
export function findDuplicateFieldKeys(schema: FormSchema): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const page of schema.pages ?? []) {
    for (const field of page.elements ?? []) {
      const name = field?.name;
      if (!name) continue;
      if (seen.has(name)) dups.add(name);
      else seen.add(name);
    }
  }
  return [...dups];
}

// Validate every currently-visible field. Hidden (visibleIf=false) fields are
// skipped so an invisible required field can't block submit.
export function validateForm(
  fields: FormField[],
  values: FormValues,
): ValidationErrors {
  const errors: ValidationErrors = {};
  for (const field of fields) {
    if (field.visibleIf && !evaluateExpression(field.visibleIf, values)) {
      continue;
    }
    const error = validateField(field, values);
    if (error) errors[field.name] = error;
  }
  return errors;
}
