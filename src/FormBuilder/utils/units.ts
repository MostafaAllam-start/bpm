// Width/height unit conversion for the layout builder. The designer stores every
// box dimension in canvas pixels (so drag, resize, snapping and reflow all work
// in one coordinate space); a field additionally records the *unit* it wants its
// width/height expressed in (default `%`). These helpers convert between the
// stored px and the chosen unit — for the property panel (show/edit the value in
// the unit) and the runtime renderer (emit a CSS length).
//
// `%` is relative to a reference length (the canvas width for widths, the canvas
// height for heights). `rem`/`em` use the conventional 16px root; `ch` is
// approximated at 8px (the advance of "0" at 16px in common UI fonts). These are
// authoring conveniences — exactness in `em`/`ch` depends on the runtime font, so
// pick `px` or `%` when precision matters.

import type { CssUnit } from "../types";

// Units offered for HEIGHT (no `col` — columns are a horizontal concept), `%`
// first (the default).
export const CSS_UNITS: CssUnit[] = ["%", "px", "rem", "em", "ch"];

// Units offered for WIDTH: the same set plus `col` (column span), listed first
// since column sizing is the designer's default width model.
export const WIDTH_UNITS: CssUnit[] = ["col", "%", "px", "rem", "em", "ch"];

const REM_PX = 16;
const CH_PX = 8;

// ── Columns ─────────────────────────────────────────────────────────────────
// A `col` width is a span on a grid of `columns` equal columns laid across the
// container's inner width (the form's content area, or a section's inner box).
// One column is `innerWidth / columns` px; geometry is still stored in px, so
// these convert between a stored px width and its column span.

// Stored px width → its column span (rounded to a whole column for display).
export function pxToCol(px: number, innerWidth: number, columns: number): number {
  const cols = Math.max(1, Math.round(columns));
  if (innerWidth <= 0) return cols;
  return Math.max(1, Math.min(cols, Math.round((px / innerWidth) * cols)));
}

// Column span → stored px width (clamped to 1..columns so it never exceeds the
// container).
export function colToPx(span: number, innerWidth: number, columns: number): number {
  const cols = Math.max(1, Math.round(columns));
  const s = Math.max(1, Math.min(cols, Math.round(span)));
  return Math.round((s / cols) * Math.max(0, innerWidth));
}

// How many pixels one unit is worth, given the reference length `refPx` (only
// used by `%`).
function pxPerUnit(unit: CssUnit, refPx: number): number {
  switch (unit) {
    case "%":
      return Math.max(1, refPx) / 100;
    case "rem":
    case "em":
      return REM_PX;
    case "ch":
      return CH_PX;
    default:
      return 1; // px
  }
}

// Convert a stored px length into the chosen unit. Integers for px, two decimals
// otherwise (so `33.33%` survives the round-trip cleanly).
export function pxToUnit(px: number, unit: CssUnit, refPx: number): number {
  const value = px / pxPerUnit(unit, refPx);
  return unit === "px" ? Math.round(value) : Math.round(value * 100) / 100;
}

// Convert a value in the chosen unit back to stored px.
export function unitToPx(value: number, unit: CssUnit, refPx: number): number {
  return Math.round(value * pxPerUnit(unit, refPx));
}

// The CSS length string for a stored px dimension in its unit (e.g. "50%",
// "240px", "1.5rem"). Defaults to `%` when no unit is set. A `col` width is
// emitted as a percentage of the reference length: the stored px already encodes
// the right column fraction for this breakpoint, so `px / refPx` reproduces the
// designed width fluidly (and `col` is never a real CSS unit).
export function cssDim(
  px: number,
  unit: CssUnit | undefined,
  refPx: number,
): string {
  const u = unit ?? "%";
  if (u === "px") return `${Math.round(px)}px`;
  if (u === "col") {
    const pct = Math.round((px / Math.max(1, refPx)) * 10000) / 100;
    return `${pct}%`;
  }
  return `${pxToUnit(px, u, refPx)}${u}`;
}
