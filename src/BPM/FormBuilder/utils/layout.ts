// Responsive column layout. Fields lay out on a 12-column grid; each field can
// span a different number of columns per breakpoint. We drive this with CSS
// custom properties + container queries (see forms.css), so the form responds
// to ITS OWN width (modal / preview pane), not the viewport.

import type { CSSProperties } from "react";
import type { Breakpoint, ColSpan } from "../types";

export const COLUMN_COUNT = 12;

// Breakpoints mirror common (Tailwind-style) widths but apply to the form
// container's inline size via `@container` queries.
export const BREAKPOINTS: { key: Breakpoint; minWidth: number }[] = [
  { key: "base",    minWidth: 0    },
  { key: "mobile",  minWidth: 390  },
  { key: "tablet",  minWidth: 768  },
  { key: "desktop", minWidth: 1024 },
];

// Inline CSS variables for a field's per-breakpoint span. Only set values are
// emitted; forms.css chains var() fallbacks so an unset breakpoint inherits the
// next smaller one, ending at a full-width default of 12.
export function colSpanToVars(colSpan: ColSpan | undefined): CSSProperties {
  const vars: Record<string, string> = {};
  if (!colSpan) return vars as CSSProperties;
  for (const { key } of BREAKPOINTS) {
    const value = colSpan[key];
    if (value != null) vars[`--col-${key}`] = String(value);
  }
  return vars as CSSProperties;
}

// Clamp a user-entered column count into the valid 1..12 range.
export function clampSpan(value: number): number {
  return Math.max(1, Math.min(COLUMN_COUNT, Math.round(value)));
}

// Browser-style breakpoint widths for the responsive Preview. Each width sits
// inside one breakpoint band so selecting it shows that breakpoint's column
// layout. Because the renderer uses container queries, constraining the preview
// frame to a width reproduces that screen. (The "Auto" mode, which fills the
// available width, is a separate toggle — not a size in this list.)
export type PreviewDevice = { id: string; labelKey: string; width: number };

export const PREVIEW_DEVICES: PreviewDevice[] = [
  { id: "mobile",  labelKey: "mobile",  width: 390  },
  { id: "tablet",  labelKey: "tablet",  width: 768  },
  { id: "desktop", labelKey: "desktop", width: 1280 },
];
