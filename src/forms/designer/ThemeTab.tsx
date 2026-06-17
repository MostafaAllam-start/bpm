// Theme tab: pick a preset and fine-tune colours, font scale, and corner
// radius. The settings live on `schema.theme` and are applied by the renderer
// (here in the live sample, and in the Preview tab / real form).

import { useTranslation } from "react-i18next";
import type { ThemeSettings } from "../types";
import { THEME_PRESETS, DEFAULT_THEME } from "../theme";
import FormRenderer from "../FormRenderer";
import type { FormModel } from "./useFormModel";

type ThemeTabProps = {
  model: FormModel;
  locale: string;
};

export default function ThemeTab({ model, locale }: ThemeTabProps) {
  const { t } = useTranslation("form");
  const theme: ThemeSettings = { ...DEFAULT_THEME, ...model.schema.theme };

  const update = (patch: Partial<ThemeSettings>) =>
    model.setTheme({ ...theme, ...patch });

  return (
    <div className="dz-theme">
      <div className="dz-theme-controls">
        <div className="dz-prop">
          <span className="dz-prop-label">{t("designer.theme.preset")}</span>
          <div className="dz-theme-presets">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`dz-theme-preset${
                  theme.preset === preset.id ? " is-active" : ""
                }`}
                onClick={() =>
                  update({
                    preset: preset.id,
                    primaryColor: preset.primaryColor,
                    backgroundColor: preset.backgroundColor,
                  })
                }
              >
                <span
                  className="dz-theme-swatch"
                  style={{ background: preset.primaryColor ?? "var(--accent)" }}
                />
                {t(`designer.${preset.labelKey}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="dz-prop dz-prop-color">
          <span className="dz-prop-label">{t("designer.theme.primary")}</span>
          <input
            type="color"
            value={theme.primaryColor ?? "#6c5ce7"}
            onChange={(e) => update({ primaryColor: e.target.value })}
          />
        </label>

        <label className="dz-prop dz-prop-color">
          <span className="dz-prop-label">{t("designer.theme.background")}</span>
          <input
            type="color"
            value={theme.backgroundColor ?? "#ffffff"}
            onChange={(e) => update({ backgroundColor: e.target.value })}
          />
        </label>

        {/* Clears the per-form colour overrides so the form falls back to the
            app accent + light/dark background. Only meaningful once the author
            has pinned a colour above. */}
        {(theme.primaryColor || theme.backgroundColor) && (
          <button
            type="button"
            className="dz-theme-reset"
            onClick={() =>
              update({
                preset: "default",
                primaryColor: undefined,
                backgroundColor: undefined,
              })
            }
          >
            {t("designer.theme.useAppColors")}
          </button>
        )}

        <label className="dz-prop">
          <span className="dz-prop-label">
            {t("designer.theme.fontScale")} ({(theme.fontScale ?? 1).toFixed(2)}×)
          </span>
          <input
            type="range"
            min={0.85}
            max={1.4}
            step={0.05}
            value={theme.fontScale ?? 1}
            onChange={(e) => update({ fontScale: Number(e.target.value) })}
          />
        </label>

        <label className="dz-prop">
          <span className="dz-prop-label">
            {t("designer.theme.cornerRadius")} ({theme.cornerRadius ?? 8}px)
          </span>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={theme.cornerRadius ?? 8}
            onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="dz-theme-sample">
        <span className="dz-theme-sample-label">{t("designer.theme.sample")}</span>
        <FormRenderer schema={{ ...model.schema, theme }} locale={locale} />
      </div>
    </div>
  );
}
