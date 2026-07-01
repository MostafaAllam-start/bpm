// Pure structural operations for a display table: merge / split cells and
// insert / delete rows and columns. Each returns a `Partial<FormField>` patch
// the caller feeds to updateField. Per-cell overrides live in a position-keyed
// map (`tableCellStyles`), so every op that shifts rows / columns also remaps
// those keys. No React, no store.

import type {
  FormField,
  LocalizedText,
  TableCellGroup,
  TableCellStyle,
} from "../types";
import { tableCellKey } from "../fields/TableField";
import type { TableRect } from "../fields/TableField";

// Body groups map to their row-array field; the header ("h") is `tableColumns`.
const BODY_KEY: Record<"rows" | "top" | "bottom", keyof FormField> = {
  rows: "tableRows",
  top: "tableTopRows",
  bottom: "tableBottomRows",
};

const emptyCell = (): LocalizedText => ({ default: "" });
const STYLE_PROPS = ["bg", "borderColor", "borderWidth", "colSpan", "rowSpan"] as const;

function bodyRows(field: FormField, group: "rows" | "top" | "bottom"): LocalizedText[][] {
  return (field[BODY_KEY[group]] as LocalizedText[][] | undefined) ?? [];
}

// Drop empty style entries and undefined props so the map stays minimal.
function pruneStyle(s: TableCellStyle): TableCellStyle | null {
  const out: TableCellStyle = {};
  for (const p of STYLE_PROPS) {
    const v = s[p];
    if (v != null) (out as Record<string, unknown>)[p] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Rebuild the style map, mapping each key's (row,col) → new coords (or null to
// drop it). `scope` limits remapping to one group (row ops); column ops pass
// null to remap across every group.
function remapStyles(
  styles: Record<string, TableCellStyle> | undefined,
  scope: TableCellGroup | null,
  map: (row: number, col: number) => { row: number; col: number } | null,
): Record<string, TableCellStyle> {
  const out: Record<string, TableCellStyle> = {};
  for (const [key, val] of Object.entries(styles ?? {})) {
    const [g, rs, cs] = key.split(":");
    const group = g as TableCellGroup;
    if (scope && group !== scope) {
      out[key] = val;
      continue;
    }
    const next = map(Number(rs), Number(cs));
    if (next) out[tableCellKey(group, next.row, next.col)] = val;
  }
  return out;
}

function setCellStyle(
  styles: Record<string, TableCellStyle> | undefined,
  key: string,
  patch: Partial<TableCellStyle>,
): Record<string, TableCellStyle> {
  const out = { ...(styles ?? {}) };
  const pruned = pruneStyle({ ...out[key], ...patch });
  if (pruned) out[key] = pruned;
  else delete out[key];
  return out;
}

// ── Columns ──────────────────────────────────────────────────────────────────

export function insertColumn(field: FormField, at: number): Partial<FormField> {
  const cols = field.tableColumns ?? [];
  const patch: Partial<FormField> = {
    tableColumns: [...cols.slice(0, at), emptyCell(), ...cols.slice(at)],
    tableCellStyles: remapStyles(field.tableCellStyles, null, (row, col) => ({
      row,
      col: col >= at ? col + 1 : col,
    })),
  };
  for (const group of ["rows", "top", "bottom"] as const) {
    const rows = field[BODY_KEY[group]] as LocalizedText[][] | undefined;
    if (rows) {
      patch[BODY_KEY[group]] = rows.map((r) => [
        ...r.slice(0, at),
        emptyCell(),
        ...r.slice(at),
      ]) as never;
    }
  }
  if (field.tableApi) {
    const keys = field.tableApi.columnKeys ?? [];
    patch.tableApi = {
      ...field.tableApi,
      columnKeys: [...keys.slice(0, at), "", ...keys.slice(at)],
    };
  }
  if (field.tableColWidths) {
    const w = field.tableColWidths;
    const val = w[Math.min(at, w.length - 1)] ?? 120;
    patch.tableColWidths = [...w.slice(0, at), val, ...w.slice(at)];
  }
  return patch;
}

// Delete columns c1..c2 (inclusive) across every row set; keeps ≥1 column.
export function deleteColumnRange(
  field: FormField,
  c1: number,
  c2: number,
): Partial<FormField> {
  const cols = field.tableColumns ?? [];
  const n = c2 - c1 + 1;
  if (cols.length - n < 1) return {};
  const drop = (i: number) => i >= c1 && i <= c2;
  const patch: Partial<FormField> = {
    tableColumns: cols.filter((_, i) => !drop(i)),
    tableCellStyles: remapStyles(field.tableCellStyles, null, (row, col) =>
      drop(col) ? null : { row, col: col > c2 ? col - n : col },
    ),
  };
  for (const group of ["rows", "top", "bottom"] as const) {
    const rows = field[BODY_KEY[group]] as LocalizedText[][] | undefined;
    if (rows) {
      patch[BODY_KEY[group]] = rows.map((r) =>
        r.filter((_, i) => !drop(i)),
      ) as never;
    }
  }
  if (field.tableApi) {
    patch.tableApi = {
      ...field.tableApi,
      columnKeys: (field.tableApi.columnKeys ?? []).filter((_, i) => !drop(i)),
    };
  }
  if (field.tableColWidths) {
    patch.tableColWidths = field.tableColWidths.filter((_, i) => !drop(i));
  }
  return patch;
}

// ── Rows (body groups only; the header is a single row) ──────────────────────

export function insertRow(
  field: FormField,
  group: "rows" | "top" | "bottom",
  at: number,
): Partial<FormField> {
  const rows = bodyRows(field, group);
  const colCount = (field.tableColumns ?? []).length;
  const blank = Array.from({ length: colCount }, emptyCell);
  const patch: Partial<FormField> = {
    [BODY_KEY[group]]: [...rows.slice(0, at), blank, ...rows.slice(at)],
    tableCellStyles: remapStyles(field.tableCellStyles, group, (row, col) => ({
      row: row >= at ? row + 1 : row,
      col,
    })),
  };
  const h = field.tableRowHeights?.[group];
  if (h) {
    patch.tableRowHeights = {
      ...field.tableRowHeights,
      [group]: [...h.slice(0, at), 0, ...h.slice(at)],
    };
  }
  return patch;
}

// Delete body rows r1..r2 (inclusive) from one group.
export function deleteRowRange(
  field: FormField,
  group: "rows" | "top" | "bottom",
  r1: number,
  r2: number,
): Partial<FormField> {
  const rows = bodyRows(field, group);
  const n = r2 - r1 + 1;
  const drop = (i: number) => i >= r1 && i <= r2;
  const patch: Partial<FormField> = {
    [BODY_KEY[group]]: rows.filter((_, i) => !drop(i)),
    tableCellStyles: remapStyles(field.tableCellStyles, group, (row, col) =>
      drop(row) ? null : { row: row > r2 ? row - n : row, col },
    ),
  };
  const h = field.tableRowHeights?.[group];
  if (h) {
    patch.tableRowHeights = {
      ...field.tableRowHeights,
      [group]: h.filter((_, i) => !drop(i)),
    };
  }
  return patch;
}

// ── Merge / split ────────────────────────────────────────────────────────────

export function mergeCells(
  field: FormField,
  group: TableCellGroup,
  rect: TableRect,
): Partial<FormField> {
  const colSpan = rect.c2 - rect.c1 + 1;
  const rowSpan = rect.r2 - rect.r1 + 1;
  if (colSpan < 2 && rowSpan < 2) return {};
  let styles = field.tableCellStyles;
  // Clear spans on every cell the merge will cover, then set the origin span.
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      if (r === rect.r1 && c === rect.c1) continue;
      styles = setCellStyle(styles, tableCellKey(group, r, c), {
        colSpan: undefined,
        rowSpan: undefined,
      });
    }
  }
  styles = setCellStyle(styles, tableCellKey(group, rect.r1, rect.c1), {
    colSpan: colSpan > 1 ? colSpan : undefined,
    rowSpan: rowSpan > 1 ? rowSpan : undefined,
  });
  return { tableCellStyles: styles };
}

export function splitCell(
  field: FormField,
  group: TableCellGroup,
  row: number,
  col: number,
): Partial<FormField> {
  return {
    tableCellStyles: setCellStyle(
      field.tableCellStyles,
      tableCellKey(group, row, col),
      { colSpan: undefined, rowSpan: undefined },
    ),
  };
}
