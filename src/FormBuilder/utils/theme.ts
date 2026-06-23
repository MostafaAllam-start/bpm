// Theming. A `ThemeSettings` is turned into CSS custom properties that the
// renderer's root sets inline; `forms.css` consumes them. Presets are just
// named starting points the user can then tweak.

import type { CSSProperties } from "react";
import type { ThemeSettings } from "../types";

export type ThemePreset = {
  id: string;
  labelKey: string;
  // Omitted on the "App theme" preset: leaving these unset clears any per-form
  // override so the form follows the app's accent + light/dark background.
  primaryColor?: string;
  backgroundColor?: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    // Follows the host app: accent from `--accent`, background from the app
    // surface, and flips automatically with dark mode. No colours set here.
    id: "default",
    labelKey: "theme.presets.default",
  },
  {
    id: "ocean",
    labelKey: "theme.presets.ocean",
    primaryColor: "#0a84ff",
    backgroundColor: "#f5f9ff",
  },
  {
    id: "forest",
    labelKey: "theme.presets.forest",
    primaryColor: "#1f9d55",
    backgroundColor: "#f4faf6",
  },
  {
    id: "sunset",
    labelKey: "theme.presets.sunset",
    primaryColor: "#e8590c",
    backgroundColor: "#fff8f3",
  },
  {
    id: "slate",
    labelKey: "theme.presets.slate",
    primaryColor: "#334155",
    backgroundColor: "#f8fafc",
  },
];

// The baseline a form starts from. Deliberately leaves `primaryColor` /
// `backgroundColor` unset so a fresh form inherits the app accent and dark/light
// background; the author opts into fixed colours via the Theme tab.
export const DEFAULT_THEME: ThemeSettings = {
  preset: "default",
  fontScale: 1,
  cornerRadius: 8,
};

export function findPreset(id: string | undefined): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

// Build the inline CSS-variable style object for a theme. Only emits variables
// for set values so unset ones inherit the stylesheet defaults.
export function themeToCssVars(theme: ThemeSettings | undefined): CSSProperties {
  const vars: Record<string, string> = {};
  if (!theme) return vars as CSSProperties;
  if (theme.primaryColor) vars["--ff-primary"] = theme.primaryColor;
  if (theme.backgroundColor) vars["--ff-bg"] = theme.backgroundColor;
  if (theme.fontScale) vars["--ff-font-scale"] = String(theme.fontScale);
  if (theme.cornerRadius != null) {
    vars["--ff-radius"] = `${theme.cornerRadius}px`;
  }
  return vars as CSSProperties;
}
