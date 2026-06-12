import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enLogin from "./locales/en/login.json";
import enStudio from "./locales/en/studio.json";
import enBpmn from "./locales/en/bpmn.json";
import enForm from "./locales/en/form.json";
import arCommon from "./locales/ar/common.json";
import arLogin from "./locales/ar/login.json";
import arStudio from "./locales/ar/studio.json";
import arBpmn from "./locales/ar/bpmn.json";
import arForm from "./locales/ar/form.json";

export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Languages that read right-to-left; their layout is mirrored (dir="rtl").
const RTL_LANGUAGES = new Set<string>(["ar"]);

// One namespace per page / major feature so each owns its own translations.
export const NAMESPACES = [
  "common",
  "login",
  "studio",
  "bpmn",
  "form",
] as const;

const resources = {
  en: {
    common: enCommon,
    login: enLogin,
    studio: enStudio,
    bpmn: enBpmn,
    form: enForm,
  },
  ar: {
    common: arCommon,
    login: arLogin,
    studio: arStudio,
    bpmn: arBpmn,
    form: arForm,
  },
};

// Mirror the document direction / lang to match the active language so Arabic
// renders right-to-left.
function applyDocumentDirection(language: string): void {
  const base = language.split("-")[0];
  document.documentElement.setAttribute(
    "dir",
    RTL_LANGUAGES.has(base) ? "rtl" : "ltr",
  );
  document.documentElement.setAttribute("lang", base);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // Map region variants (e.g. "en-US") down to the base language.
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    ns: [...NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "app-language",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

applyDocumentDirection(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
