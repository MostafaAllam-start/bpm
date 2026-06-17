// Starter schema + small IO helpers for the designer host.

import type { TFunction } from "i18next";
import type { FormSchema } from "../types";

// A blank-but-useful contact form, mirroring the previous editor's starter so
// opening a fresh actor form lands on something familiar.
export function buildInitialSchema(
  t: TFunction,
  actorId?: string | null,
  actorLabel?: string | null,
): FormSchema {
  const name = actorLabel || actorId;
  const title = name
    ? t("headerFor", { name })
    : t("defaults.contactTitle");
  return {
    title,
    pages: [
      {
        name: "page1",
        elements: [
          { type: "text", name: "name", title: t("defaults.name"), isRequired: true },
          { type: "email", name: "email", title: t("defaults.email") },
          { type: "boolean", name: "subscribe", title: t("defaults.subscribe") },
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
