import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "./index.ts";
import type { AppLanguage } from "./index.ts";
import "./LanguageSwitcher.css";

// Compact EN / عربي toggle. Persists the choice (via the language detector's
// localStorage cache) and applies it immediately, flipping RTL for Arabic.
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? "en").split("-")[0];

  return (
    <div className="lang-switcher" role="group" aria-label={t("language.label")}>
      {SUPPORTED_LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className={
            "lang-switcher-btn" + (current === language ? " is-active" : "")
          }
          aria-pressed={current === language}
          onClick={() => i18n.changeLanguage(language)}
        >
          {t(`language.${language}` as `language.${AppLanguage}`)}
        </button>
      ))}
    </div>
  );
}
