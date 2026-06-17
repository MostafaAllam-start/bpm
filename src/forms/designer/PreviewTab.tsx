// Live preview with browser-style responsive controls:
//   • Two icon buttons toggle the mode — Responsive (constrain to a breakpoint)
//     or Auto (fill the available width).
//   • In Responsive mode, a segmented bar (like a browser ruler) lets you pick a
//     breakpoint; each segment is labelled with its size (Mobile / SM / MD / LG
//     / XL) and pixel width.
// The renderer uses container queries, so the form reflows to the chosen width.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FormSchema } from "../types";
import FormRenderer from "../FormRenderer";
import { PREVIEW_DEVICES } from "../layout";

type Mode = "responsive" | "auto";

const ResponsiveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="5" width="13" height="9" rx="1.4" />
    <path d="M6.5 17h6" />
    <rect x="15.5" y="9.5" width="6" height="9.5" rx="1.3" />
  </svg>
);

const AutoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5v14M20 5v14" />
    <path d="M8 12h8" />
    <path d="m9.5 9.5-2.5 2.5 2.5 2.5M14.5 9.5l2.5 2.5-2.5 2.5" />
  </svg>
);

type PreviewTabProps = {
  schema: FormSchema;
  locale: string;
};

export default function PreviewTab({ schema, locale }: PreviewTabProps) {
  const { t } = useTranslation("form");
  const [mode, setMode] = useState<Mode>("auto");
  const [presetId, setPresetId] = useState("md");

  const preset = PREVIEW_DEVICES.find((d) => d.id === presetId) ?? PREVIEW_DEVICES[2];
  const width = mode === "responsive" ? preset.width : null;
  const hasFields = schema.pages.some((page) => page.elements.length > 0);

  return (
    <div className="dz-preview-tab">
      <div className="dz-preview-bar">
        <div className="dz-preview-modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "responsive"}
            aria-label={t("designer.preview.responsive")}
            title={t("designer.preview.responsive")}
            className={`dz-preview-mode${mode === "responsive" ? " is-active" : ""}`}
            onClick={() => setMode("responsive")}
          >
            <ResponsiveIcon />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "auto"}
            aria-label={t("designer.preview.auto")}
            title={t("designer.preview.auto")}
            className={`dz-preview-mode${mode === "auto" ? " is-active" : ""}`}
            onClick={() => setMode("auto")}
          >
            <AutoIcon />
          </button>
        </div>

        {mode === "responsive" && (
          <>
            <div className="dz-bp-bar" role="tablist">
              {PREVIEW_DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={d.id === presetId}
                  className={`dz-bp-seg${d.id === presetId ? " is-active" : ""}`}
                  onClick={() => setPresetId(d.id)}
                >
                  <span className="dz-bp-name">
                    {t(`designer.preview.devices.${d.labelKey}`)}
                  </span>
                  <span className="dz-bp-px">{d.width}</span>
                </button>
              ))}
            </div>
            <span className="dz-preview-current">{preset.width}px</span>
          </>
        )}
      </div>

      <div className="dz-preview-stage">
        {hasFields ? (
          <div className="dz-preview-frame" style={width ? { width } : undefined}>
            <FormRenderer schema={schema} locale={locale} />
          </div>
        ) : (
          <div className="dz-preview-empty">{t("designer.previewEmpty")}</div>
        )}
      </div>
    </div>
  );
}
