// App-level appearance state: light/dark mode and the accent colour. Both are
// driven by the document root so the whole UI — including the in-house form
// runtime, which reads `--accent` and the dark `.dark` tokens — follows along.
//
//  - Dark mode is a `dark` / `light` class on <html>. `index.css` styles
//    `:root.dark`; the `light` class is just an explicit "not dark" marker so a
//    stored light choice wins even when the OS prefers dark.
//  - The accent is set as an inline `--accent` custom property on <html>. Every
//    other accent token (`--accent-bg`, `--accent-border`, gradient, and the
//    form's `--ff-primary`) is color-mixed from it, so this one write re-tints
//    everything.
//
// Both persist to localStorage and are re-applied by `initAppearance()` before
// React renders (called from main.tsx) to avoid a flash of the wrong theme.

const MODE_KEY = "app-theme-mode";
const ACCENT_KEY = "app-accent";

// The accent options shown in the header switcher. The first is the app default
// (`--accent` in index.css); the rest are a small spread of hues.
export const ACCENT_SWATCHES = [
  "#a435f0",
  "#0a84ff",
  "#1f9d55",
  "#e8590c",
  "#e23670",
  "#f5a623",
] as const;

const root = () => document.documentElement;

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

export function isDark(): boolean {
  return root().classList.contains("dark");
}

export function setDark(dark: boolean): void {
  root().classList.toggle("dark", dark);
  root().classList.toggle("light", !dark);
  localStorage.setItem(MODE_KEY, dark ? "dark" : "light");
}

export function toggleDark(): boolean {
  const next = !isDark();
  setDark(next);
  return next;
}

export function getAccent(): string {
  return (
    localStorage.getItem(ACCENT_KEY) ||
    root().style.getPropertyValue("--accent").trim() ||
    ACCENT_SWATCHES[0]
  );
}

export function setAccent(color: string): void {
  root().style.setProperty("--accent", color);
  localStorage.setItem(ACCENT_KEY, color);
}

// Apply the stored (or OS-derived) appearance. Safe to call before first paint.
export function initAppearance(): void {
  const storedMode = localStorage.getItem(MODE_KEY);
  setDark(storedMode ? storedMode === "dark" : prefersDark());

  const storedAccent = localStorage.getItem(ACCENT_KEY);
  if (storedAccent) root().style.setProperty("--accent", storedAccent);
}
