// Header control for app appearance: a light/dark toggle and a row of accent
// swatches. Both write to the document root via themeMode helpers, so the whole
// app — and the form runtime/designer, which derive their colours from the app
// tokens — re-theme live.

import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ACCENT_SWATCHES,
  getAccent,
  isDark,
  setAccent,
  toggleDark,
} from "./theme/themeMode";

export default function ThemeToggle() {
  const { t } = useTranslation("studio");
  const [dark, setDarkState] = useState(isDark);
  const [accent, setAccentState] = useState(getAccent);

  return (
    <div className="theme-toggle">
      <div className="theme-accents" role="group" aria-label={t("theme.accent")}>
        {ACCENT_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            className={`theme-accent${
              accent.toLowerCase() === color.toLowerCase() ? " is-active" : ""
            }`}
            style={{ background: color }}
            aria-label={color}
            aria-pressed={accent.toLowerCase() === color.toLowerCase()}
            onClick={() => {
              setAccent(color);
              setAccentState(color);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        className="theme-mode-btn"
        aria-label={dark ? t("theme.light") : t("theme.dark")}
        title={dark ? t("theme.light") : t("theme.dark")}
        onClick={() => setDarkState(toggleDark())}
      >
        {dark ? (
          // Sun — click to go light.
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <g
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
            </g>
          </svg>
        ) : (
          // Moon — click to go dark.
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
