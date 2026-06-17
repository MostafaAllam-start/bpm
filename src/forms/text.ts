// Localized-text helpers. A `LocalizedText` is either a plain string (one
// language) or an object `{ default, en, ar, … }`. These read/write either shape
// so the rest of the app never branches on it.

import type { LocalizedText } from "./types";

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
    // A plain string is the default/base language value.
    return base === "en" ? value : "";
  }
  return value[base] ?? (base === "en" ? value.default ?? "" : "");
}

// Return a new `LocalizedText` with `locale` set to `text`. Promotes a plain
// string to the object form once a non-default locale is edited; collapses back
// to a plain string when only the default remains.
export function setLocaleText(
  value: LocalizedText | undefined,
  locale: string,
  text: string,
): LocalizedText {
  const base = locale.split("-")[0];
  const obj: Record<string, string> =
    typeof value === "string"
      ? { default: value }
      : { ...(value ?? {}) };

  if (base === "en") obj.default = text;
  else obj[base] = text;

  // Drop empties (except keep `default` as the anchor).
  for (const key of Object.keys(obj)) {
    if (key !== "default" && !obj[key]) delete obj[key];
  }
  if (!obj.default) obj.default = "";

  const extraLocales = Object.keys(obj).filter((k) => k !== "default");
  // Collapse to a plain string when nothing but the default is set.
  if (extraLocales.length === 0) return obj.default;
  return obj as LocalizedText;
}
