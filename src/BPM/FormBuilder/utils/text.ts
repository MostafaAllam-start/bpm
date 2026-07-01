// Localized-text helpers. A `LocalizedText` is either a plain string (one
// language) or an object `{ default, en, ar, … }`. These read/write either shape
// so the rest of the app never branches on it.

import type { LocalizedText } from "../types";

// Resolve the best string for `locale`: exact locale → default → first value →
// "". Plain strings are returned as-is.
export function resolveText(
  value: LocalizedText | undefined,
  locale: string,
): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const base = locale.split("-")[0];
  if (value[base]) return value[base];
  if (value.default) return value.default;
  const first = Object.values(value).find((v) => typeof v === "string" && v);
  return first ?? "";
}

// The string stored for a specific locale (no fallback) — used by the Translate
// tab to show what's actually set per column.
export function getLocaleText(
  value: LocalizedText | undefined,
  locale: string,
): string {
  if (value == null) return "";
  const base = locale.split("-")[0];
  if (typeof value === "string") {
    // A plain string has no per-locale breakdown — treat it as the value for
    // every locale so legacy fields show their text in the AR input too.
    return value;
  }
  return value[base] ?? (base === "en" ? value.default ?? "" : "");
}

// Return a new `LocalizedText` with `locale` set to `text`. Promotes a plain
// string to the object form once a non-default locale is edited; collapses back
// to a plain string when only the default remains.
//
// `primaryLang` is the current UI language (defaults to "en"). The `default`
// key always mirrors the primary language's value so that unsupported-locale
// rendering falls back to whatever the form author was typing in.
// When a non-English primary edits its field and "en" hasn't been stored
// explicitly yet, the current `default` (which held the English text) is
// preserved under the "en" key before being overwritten.
export function setLocaleText(
  value: LocalizedText | undefined,
  locale: string,
  text: string,
  primaryLang = "en",
): LocalizedText {
  const base = locale.split("-")[0];
  const primaryBase = primaryLang.split("-")[0];
  const obj: Record<string, string> =
    typeof value === "string"
      ? { default: value }
      : { ...(value ?? {}) };

  // Always write to the explicit locale key.
  obj[base] = text;

  if (base === primaryBase) {
    // Editing the primary language: sync `default` to this value.
    // If primary is non-English and "en" is not yet an explicit key, rescue
    // the current `default` (English baseline) under "en" first — even when
    // `default` is empty, so the EN input never falls back to an AR default.
    if (primaryBase !== "en" && !("en" in obj)) {
      obj["en"] = obj.default ?? "";
    }
    obj.default = text;
  }

  // Drop empties (except keep `default` and `en` as anchors — `en` must stay
  // explicit so the EN input never falls back to a non-English `default`).
  for (const key of Object.keys(obj)) {
    if (key !== "default" && key !== "en" && !obj[key]) delete obj[key];
  }
  if (!obj.default) obj.default = "";

  const extraLocales = Object.keys(obj).filter((k) => k !== "default");
  // Collapse to a plain string when nothing but the default is set.
  if (extraLocales.length === 0) return obj.default;
  return obj as LocalizedText;
}
