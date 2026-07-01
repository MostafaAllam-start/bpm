// Starter schema + small IO helpers for the designer host.

import type { TFunction } from "i18next";
import type { FormSchema, LocalizedText } from "../types";

// A blank-but-useful contact form, mirroring the previous editor's starter so
// opening a fresh actor form lands on something familiar.
//
// Each title is stored as a bilingual `LocalizedText` (`{ default: en, ar }`) —
// NOT a single `t()` string in the current UI language — so the designer's
// per-language property inputs show English in the EN field and Arabic in the AR
// field. We pull both languages straight from the i18n resources (both bundles
// are loaded synchronously at init) so the translations stay the single source.
export function buildInitialSchema(
  t: TFunction,
  actorId?: string | null,
  actorLabel?: string | null,
  mode?: string | null,
): FormSchema {
  // Resolve a form-namespace key in both languages into a `LocalizedText`.
  const tx = (key: string, opts?: Record<string, unknown>): LocalizedText => ({
    default: t(key, { ...opts, lng: "en" }),
    ar: t(key, { ...opts, lng: "ar" }),
  });

  const name = actorLabel || actorId;
  const isDocMode = mode === "email" || mode === "pdf";
  const titleKey = isDocMode ? "reportFor" : "headerFor";
  const title = name ? tx(titleKey, { name }) : tx("defaults.contactTitle");

  if (mode === "pdf") {
    // PDF starts blank on an A4 canvas; content fields don't apply here.
    return {
      title,
      pages: [{ name: "page1", elements: [] }],
      canvas: {
        width: 794,
        height: 1123,
        autoWidth: false,
        pageSize: "a4",
        pageWidth: 794,
        pageHeight: 1123,
      },
    };
  }

  return {
    title,
    pages: [
      {
        name: "page1",
        elements: [
          { type: "text", name: "name", title: tx("defaults.name"), isRequired: true },
          { type: "email", name: "email", title: tx("defaults.email") },
          { type: "boolean", name: "subscribe", title: tx("defaults.subscribe") },
        ],
      },
    ],
  };
}

export function downloadFile(name: string, data: string, mimeType: string): void {
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

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
