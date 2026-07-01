// Geometry helpers shared by the table renderer and its inline editor: the
// selection rectangle, per-cell spans, and the coverage grid (which cells are
// hidden underneath a merged neighbour). Pure — no React, no store.

import type {
  TableCellGroup,
  TableCellStyle,
  TableSelection,
} from "../../types";
import { tableCellKey } from "./cellStyle";

export type CellStyleMap = Record<string, TableCellStyle> | undefined;

export type TableRect = { r1: number; c1: number; r2: number; c2: number };

// Normalised rectangle (top-left → bottom-right) of a selection's anchor+focus.
export function selectionRect(sel: TableSelection): TableRect {
  return {
    r1: Math.min(sel.anchor.row, sel.focus.row),
    c1: Math.min(sel.anchor.col, sel.focus.col),
    r2: Math.max(sel.anchor.row, sel.focus.row),
    c2: Math.max(sel.anchor.col, sel.focus.col),
  };
}

export function rectContains(rect: TableRect, r: number, c: number): boolean {
  return r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
}

export function isSingleCell(rect: TableRect): boolean {
  return rect.r1 === rect.r2 && rect.c1 === rect.c2;
}

// The colSpan / rowSpan stored for a cell (defaulting to 1×1).
export function spanOf(
  styles: CellStyleMap,
  group: TableCellGroup,
  r: number,
  c: number,
): { colSpan: number; rowSpan: number } {
  const s = styles?.[tableCellKey(group, r, c)];
  return {
    colSpan: Math.max(1, s?.colSpan ?? 1),
    rowSpan: Math.max(1, s?.rowSpan ?? 1),
  };
}

// The set of "r:c" cells hidden underneath a merged neighbour. Origins are
// processed top-left → bottom-right; a cell already covered can't itself span
// (its span data, if any, is ignored) so overlaps can't runaway.
export function computeCoverage(
  styles: CellStyleMap,
  group: TableCellGroup,
  rowCount: number,
  colCount: number,
): Set<string> {
  const covered = new Set<string>();
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const { colSpan, rowSpan } = spanOf(styles, group, r, c);
      if (colSpan === 1 && rowSpan === 1) continue;
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          covered.add(`${r + dr}:${c + dc}`);
        }
      }
    }
  }
  return covered;
}

// Total px table width from explicit column widths (undefined ⇒ let CSS use
// 100% and share equally).
export function tableTotalWidth(widths: number[] | undefined): number | undefined {
  return widths ? widths.reduce((a, b) => a + (b || 0), 0) : undefined;
}

// CSS width for column `i`: explicit px, else an equal share of the table.
export function colWidthCss(
  widths: number[] | undefined,
  i: number,
  colCount: number,
): string {
  const w = widths?.[i];
  return w ? `${w}px` : `${(100 / Math.max(1, colCount)).toFixed(4)}%`;
}

// Explicit px height for a row (0 / unset ⇒ auto, letting the CSS min apply).
export function rowHeightCss(
  heights: Partial<Record<TableCellGroup, number[]>> | undefined,
  group: TableCellGroup,
  row: number,
): number | undefined {
  const h = heights?.[group]?.[row];
  return h && h > 0 ? h : undefined;
}

// The colSpan / rowSpan to render for a cell, clamped so a merge never reaches
// past the grid edge.
export function clampedSpan(
  styles: CellStyleMap,
  group: TableCellGroup,
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
): { colSpan: number; rowSpan: number } {
  const { colSpan, rowSpan } = spanOf(styles, group, r, c);
  return {
    colSpan: Math.min(colSpan, colCount - c),
    rowSpan: Math.min(rowSpan, rowCount - r),
  };
}
