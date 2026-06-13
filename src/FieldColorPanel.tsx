import { useTranslation } from "react-i18next";

import {
  COLOR_TARGETS,
  applyColorStyles,
  getRootField,
  type ColorMap,
  type ColorTarget,
} from "./fieldColors";

type Props = {
  // The form-js editor instance (didi injector). Typed loosely because form-js
  // ships no TS types for these services.
  editor: any | null;
  // Bumped on every editor change / selection change so this panel re-reads the
  // live schema and re-renders.
  revision: number;
  // CSS scope prefix for the injected color rules (the editor container class).
  scope: string;
};

const SWATCH_FALLBACK = "#000000";

export default function FieldColorPanel({ editor, revision, scope }: Props) {
  const { t } = useTranslation("form");

  // `revision` is the render trigger — read it so the dependency is explicit.
  void revision;

  if (!editor) return null;

  const selection = editor.get("selection");
  const modeling = editor.get("modeling");
  const selected = selection?.get?.() ?? null;

  // The root form field has no `_parent`; only a real (non-root) field gets the
  // per-field controls.
  const field = selected && selected._parent ? selected : null;
  const root = getRootField(editor);

  const fieldColors: ColorMap = (field?.colors as ColorMap) ?? {};
  const themeColors: ColorMap = (root?.theme as ColorMap) ?? {};

  function writeColors(
    target: any,
    key: "colors" | "theme",
    current: ColorMap,
    colorTarget: ColorTarget,
    value: string | null,
  ) {
    if (!target) return;
    const next: ColorMap = { ...current };
    if (value) next[colorTarget] = value;
    else delete next[colorTarget];
    modeling.editFormField(
      target,
      key,
      Object.keys(next).length ? next : undefined,
    );
    applyColorStyles(editor, scope);
  }

  function renderRow(
    colors: ColorMap,
    onChange: (target: ColorTarget, value: string | null) => void,
  ) {
    return COLOR_TARGETS.map((target) => {
      const value = colors[target];
      return (
        <label key={target} className="form-color-row">
          <span className="form-color-name">{t(`colors.${target}`)}</span>
          <input
            type="color"
            className="form-color-input"
            value={value ?? SWATCH_FALLBACK}
            onChange={(event) => onChange(target, event.target.value)}
          />
          <button
            type="button"
            className="form-color-clear"
            title={t("colors.clear")}
            aria-label={t("colors.clear")}
            disabled={!value}
            onClick={() => onChange(target, null)}
          >
            ✕
          </button>
        </label>
      );
    });
  }

  return (
    <div className="form-color-panel">
      <section className="form-color-section">
        <h4>{t("colors.fieldTitle")}</h4>
        {field ? (
          renderRow(fieldColors, (target, value) =>
            writeColors(field, "colors", fieldColors, target, value),
          )
        ) : (
          <p className="form-color-hint">{t("colors.selectFieldHint")}</p>
        )}
      </section>

      <section className="form-color-section">
        <h4>{t("colors.themeTitle")}</h4>
        {renderRow(themeColors, (target, value) =>
          writeColors(root, "theme", themeColors, target, value),
        )}
      </section>
    </div>
  );
}
