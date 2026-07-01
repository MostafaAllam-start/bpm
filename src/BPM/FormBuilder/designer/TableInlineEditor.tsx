// In-place editor for the display-table field, shown while the table is the
// primary selection. It separates two gestures:
//   • single click / drag / shift-click → SELECT cells (a rectangular block),
//     surfaced to the property panel for styling + structural actions;
//   • double click → EDIT that cell's rich text (contentEditable + the shared
//     TextFormatToolbar).
// Merged cells (colSpan/rowSpan) render spanned; cells covered by a merge are
// skipped. Only the manual arrays are editable — the header (`tableColumns`) and
// the manual body rows (`tableRows`, or `tableTopRows`/`tableBottomRows` around
// an API source). API-fetched rows aren't shown here.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

import type { FormField, LocalizedText, TableCellGroup } from "../types";
import { getLocaleText, setLocaleText } from "../utils/text";
import { insertColumn, insertRow } from "./tableOps";
import {
  tableCellKey,
  computeCoverage,
  clampedSpan,
  selectionRect,
  rectContains,
  tableTotalWidth,
  colWidthCss,
  rowHeightCss,
} from "../fields/TableField";
import { useDesigner, useDesignerStoreApi } from "./designerStore";
import { caretAtPoint } from "./caretFromPoint";

type BodyKey = "tableRows" | "tableTopRows" | "tableBottomRows";
const KEY_OF: Record<"rows" | "top" | "bottom", BodyKey> = {
  rows: "tableRows",
  top: "tableTopRows",
  bottom: "tableBottomRows",
};

type CellLoc = { group: TableCellGroup; row: number; col: number };

// CSS overrides for a cell (background / border colour / width).
function cellCss(
  field: FormField,
  group: TableCellGroup,
  row: number,
  col: number,
): CSSProperties | undefined {
  const s = field.tableCellStyles?.[tableCellKey(group, row, col)];
  if (!s || (!s.bg && !s.borderColor && s.borderWidth == null)) return undefined;
  return {
    ...(s.bg ? { backgroundColor: s.bg } : {}),
    ...(s.borderColor ? { borderColor: s.borderColor } : {}),
    ...(s.borderWidth != null
      ? { borderWidth: `${s.borderWidth}px`, borderStyle: "solid" }
      : {}),
  };
}

// A selectable (non-editing) cell: click selects, drag/shift extends the block,
// double-click opens text editing.
function SelectCell({
  as: Tag,
  html,
  style,
  colSpan,
  rowSpan,
  colStart,
  colEnd,
  selected,
  onSelect,
  onExtend,
  onEdit,
}: {
  as: "th" | "td";
  html: string;
  style?: CSSProperties;
  colSpan?: number;
  rowSpan?: number;
  colStart: number;
  colEnd: number;
  selected: boolean;
  onSelect: (shift: boolean) => void;
  onExtend: () => void;
  onEdit: (point: { x: number; y: number }) => void;
}) {
  return (
    <Tag
      className={`dz-tc dz-lc-nodrag${selected ? " is-sel" : ""}`}
      dir="auto"
      colSpan={colSpan}
      rowSpan={rowSpan}
      data-col={colStart}
      data-colend={colEnd}
      style={style}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect(e.shiftKey);
      }}
      onPointerEnter={onExtend}
      onDoubleClick={(e) => onEdit({ x: e.clientX, y: e.clientY })}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// A cell in text-edit mode: contentEditable, sets HTML imperatively, caret at the
// double-click point, commits on blur (but not when focus goes to the toolbar).
function EditCell({
  as: Tag,
  initialHtml,
  point,
  style,
  colSpan,
  rowSpan,
  colStart,
  colEnd,
  onCommit,
  onExit,
}: {
  as: "th" | "td";
  initialHtml: string;
  point?: { x: number; y: number };
  style?: CSSProperties;
  colSpan?: number;
  rowSpan?: number;
  colStart: number;
  colEnd: number;
  onCommit: (html: string) => void;
  onExit: () => void;
}) {
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = initialHtml;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("defaultParagraphSeparator", false, "div");
    el.focus();
    const range = point ? caretAtPoint(point.x, point.y, el) : null;
    const sel = window.getSelection();
    if (range) {
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (e: React.FocusEvent) => {
    const next =
      (e.relatedTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    if (next?.closest?.(".tf-toolbar")) return; // keep editing while formatting
    if (ref.current) onCommit(ref.current.innerHTML);
    onExit();
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="dz-tc dz-inline-editor dz-lc-nodrag is-editing-cell"
      dir="auto"
      colSpan={colSpan}
      rowSpan={rowSpan}
      data-col={colStart}
      data-colend={colEnd}
      style={style}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) onCommit(ref.current.innerHTML);
          onExit();
        } else {
          e.stopPropagation();
        }
      }}
    />
  );
}

export default function TableInlineEditor({
  field,
  editingLocale,
  primaryLang,
}: {
  field: FormField;
  editingLocale: string;
  primaryLang: string;
}) {
  const store = useDesignerStoreApi();
  const sel = useDesigner((s) => s.tableSelection);
  const [textEdit, setTextEdit] = useState<{
    loc: CellLoc;
    point?: { x: number; y: number };
  } | null>(null);
  const draggingRef = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);

  const cols = field.tableColumns ?? [];
  const colCount = cols.length;
  const isApi = field.tableSource === "api";
  const showHead = field.tableHeader !== false && colCount > 0;
  const styles = field.tableCellStyles;
  const activeSel = sel && sel.fieldName === field.name ? sel : null;

  // End drag-select on any pointer release, anywhere.
  useEffect(() => {
    const up = () => {
      draggingRef.current = false;
    };
    document.addEventListener("pointerup", up);
    return () => document.removeEventListener("pointerup", up);
  }, []);

  const rowCountOf = (group: TableCellGroup): number => {
    if (group === "h") return 1;
    return field[KEY_OF[group]]?.length ?? 0;
  };
  const coverCache: Partial<Record<TableCellGroup, Set<string>>> = {};
  const coverOf = (group: TableCellGroup): Set<string> =>
    (coverCache[group] ??= computeCoverage(styles, group, rowCountOf(group), colCount));

  const selectCell = (loc: CellLoc, extend: boolean) => {
    const anchor =
      extend && activeSel && activeSel.group === loc.group
        ? activeSel.anchor
        : { row: loc.row, col: loc.col };
    store.getState().setTableSelection({
      fieldName: field.name,
      group: loc.group,
      anchor,
      focus: { row: loc.row, col: loc.col },
    });
  };

  const extendTo = (loc: CellLoc) => {
    if (!draggingRef.current || !activeSel || activeSel.group !== loc.group) return;
    store.getState().setTableSelection({
      fieldName: field.name,
      group: loc.group,
      anchor: activeSel.anchor,
      focus: { row: loc.row, col: loc.col },
    });
  };

  const isSelected = (loc: CellLoc) =>
    !!activeSel &&
    activeSel.group === loc.group &&
    rectContains(selectionRect(activeSel), loc.row, loc.col);

  const commitHeader = (c: number, html: string) => {
    const next = cols.map((cell, ci) =>
      ci === c ? setLocaleText(cell, editingLocale, html, primaryLang) : cell,
    );
    store.getState().updateField(field.name, { tableColumns: next });
  };

  const commitBody = (group: "rows" | "top" | "bottom", r: number, c: number, html: string) => {
    const key = KEY_OF[group];
    const rows = field[key] ?? [];
    const next = rows.map((row, ri) =>
      ri === r
        ? Array.from({ length: colCount }, (_, ci) =>
            ci === c
              ? setLocaleText(row[ci], editingLocale, html, primaryLang)
              : (row[ci] ?? { default: "" }),
          )
        : row,
    );
    store.getState().updateField(field.name, { [key]: next });
  };

  const commitText = (loc: CellLoc, html: string) => {
    if (loc.group === "h") commitHeader(loc.col, html);
    else commitBody(loc.group, loc.row, loc.col, html);
  };

  // Render the cells of one row (a header row or a body row).
  const renderRow = (group: TableCellGroup, r: number, rowCells: LocalizedText[]) => {
    const cover = coverOf(group);
    const as: "th" | "td" = group === "h" ? "th" : "td";
    return Array.from({ length: colCount }, (_, c) => {
      if (cover.has(`${r}:${c}`)) return null;
      const loc: CellLoc = { group, row: r, col: c };
      const { colSpan, rowSpan } = clampedSpan(styles, group, r, c, rowCountOf(group), colCount);
      const spanCol = colSpan > 1 ? colSpan : undefined;
      const spanRow = rowSpan > 1 ? rowSpan : undefined;
      const colEnd = Math.min(c + colSpan, colCount);
      const style = cellCss(field, group, r, c);
      const html = getLocaleText(rowCells[c], editingLocale);
      const editing =
        textEdit?.loc.group === group &&
        textEdit.loc.row === r &&
        textEdit.loc.col === c;
      if (editing) {
        return (
          <EditCell
            key={c}
            as={as}
            initialHtml={html}
            point={textEdit?.point}
            style={style}
            colSpan={spanCol}
            rowSpan={spanRow}
            colStart={c}
            colEnd={colEnd}
            onCommit={(h) => commitText(loc, h)}
            onExit={() => setTextEdit(null)}
          />
        );
      }
      return (
        <SelectCell
          key={c}
          as={as}
          html={html}
          style={style}
          colSpan={spanCol}
          rowSpan={spanRow}
          colStart={c}
          colEnd={colEnd}
          selected={isSelected(loc)}
          onSelect={(shift) => {
            draggingRef.current = true;
            selectCell(loc, shift);
          }}
          onExtend={() => extendTo(loc)}
          onEdit={(pt) => {
            selectCell(loc, false);
            setTextEdit({ loc, point: pt });
          }}
        />
      );
    });
  };

  const bodyGroups: ("rows" | "top" | "bottom")[] = isApi
    ? ["top", "bottom"]
    : ["rows"];

  return (
    <div
      className={`ff-table-wrap dz-table-editor${
        field.tableAutoHeight ? " is-auto-height" : ""
      }`}
      style={{ pointerEvents: "auto" }}
    >
      <div className="dz-table-inner" ref={innerRef}>
        <table
          className="ff-table"
          style={{ width: tableTotalWidth(field.tableColWidths) }}
        >
          <colgroup>
            {cols.map((_, i) => (
              <col
                key={i}
                style={{ width: colWidthCss(field.tableColWidths, i, colCount) }}
              />
            ))}
          </colgroup>
          {showHead && (
            <thead>
              <tr style={{ height: rowHeightCss(field.tableRowHeights, "h", 0) }}>
                {renderRow("h", 0, cols)}
              </tr>
            </thead>
          )}
          <tbody>
            {bodyGroups.flatMap((group) =>
              (field[KEY_OF[group]] ?? []).map((row, r) => (
                <tr
                  key={`${group}-${r}`}
                  data-rgroup={group}
                  data-ridx={r}
                  style={{ height: rowHeightCss(field.tableRowHeights, group, r) }}
                >
                  {renderRow(group, r, row)}
                </tr>
              )),
            )}
          </tbody>
        </table>
        <TableBoundaryTools
          innerRef={innerRef}
          field={field}
          colCount={colCount}
          disabled={textEdit !== null}
          onPatch={(p) => store.getState().updateField(field.name, p)}
        />
      </div>
    </div>
  );
}

// ── Boundary tools: on-canvas resize handles + insert controls ───────────────
// Measures the rendered grid, then on hover near a row/column boundary shows an
// accent line with a "+" (insert a row/column there) and a grip (drag to resize
// the row above / column to the left). Resize previews live by writing to the DOM
// <col>/<tr> imperatively and commits px sizes to the store on release.

const MIN_COL = 40;
const MIN_ROW = 28;

type BodyGroup = "rows" | "top" | "bottom";
type Metrics = {
  w: number;
  h: number;
  colX: (number | undefined)[];
  rows: { group: BodyGroup; ys: number[] }[];
};
type Hover =
  | { kind: "col"; idx: number; x: number }
  | { kind: "row"; group: BodyGroup; idx: number; y: number };

function TableBoundaryTools({
  innerRef,
  field,
  colCount,
  disabled,
  onPatch,
}: {
  innerRef: RefObject<HTMLDivElement | null>;
  field: FormField;
  colCount: number;
  disabled: boolean;
  onPatch: (p: Partial<FormField>) => void;
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const draggingRef = useRef(false);

  const measure = useCallback(() => {
    const inner = innerRef.current;
    const table = inner?.querySelector("table");
    if (!inner || !table) return;
    const base = inner.getBoundingClientRect();
    const tRect = table.getBoundingClientRect();
    const colX: (number | undefined)[] = Array.from(
      { length: colCount + 1 },
      () => undefined,
    );
    inner.querySelectorAll<HTMLElement>("[data-col]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const c = Number(el.dataset.col);
      const ce = Number(el.dataset.colend);
      if (colX[c] === undefined) colX[c] = r.left - base.left;
      colX[ce] = r.right - base.left;
    });
    const groupTrs: Record<string, HTMLElement[]> = {};
    inner.querySelectorAll<HTMLElement>("tr[data-rgroup]").forEach((tr) => {
      (groupTrs[tr.dataset.rgroup as string] ??= []).push(tr);
    });
    const rows = Object.entries(groupTrs).map(([group, trs]) => {
      const ys = trs.map((tr) => tr.getBoundingClientRect().top - base.top);
      ys.push(trs[trs.length - 1].getBoundingClientRect().bottom - base.top);
      return { group: group as BodyGroup, ys };
    });
    const next: Metrics = { w: tRect.width, h: tRect.height, colX, rows };
    setMetrics((prev) =>
      prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, [colCount, innerRef]);

  useLayoutEffect(() => {
    measure();
  }, [
    measure,
    field.tableColWidths,
    field.tableRowHeights,
    field.tableColumns,
    field.tableRows,
    field.tableTopRows,
    field.tableBottomRows,
    field.tableHeader,
  ]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(inner);
    return () => ro.disconnect();
  }, [measure, innerRef]);

  // Hover detection: show the control for the nearest boundary under the cursor.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const onMove = (e: PointerEvent) => {
      if (disabled || draggingRef.current || e.buttons !== 0 || !metrics) {
        setHover(null);
        return;
      }
      const base = inner.getBoundingClientRect();
      const x = e.clientX - base.left;
      const y = e.clientY - base.top;
      const TH = 8;
      let best: Hover | null = null;
      let bestDist = TH;
      metrics.colX.forEach((cx, idx) => {
        if (cx == null || y < 0 || y > metrics.h) return;
        const d = Math.abs(cx - x);
        if (d <= bestDist) {
          bestDist = d;
          best = { kind: "col", idx, x: cx };
        }
      });
      if (x >= 0 && x <= metrics.w) {
        for (const rg of metrics.rows) {
          rg.ys.forEach((cy, idx) => {
            const d = Math.abs(cy - y);
            if (d <= bestDist) {
              bestDist = d;
              best = { kind: "row", group: rg.group, idx, y: cy };
            }
          });
        }
      }
      setHover((prev) =>
        JSON.stringify(prev) === JSON.stringify(best) ? prev : best,
      );
    };
    const onLeave = () => {
      if (!draggingRef.current) setHover(null);
    };
    inner.addEventListener("pointermove", onMove);
    inner.addEventListener("pointerleave", onLeave);
    return () => {
      inner.removeEventListener("pointermove", onMove);
      inner.removeEventListener("pointerleave", onLeave);
    };
  }, [innerRef, metrics, disabled]);

  const startColResize = (e: React.PointerEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const inner = innerRef.current;
    if (!inner || !metrics) return;
    const cols = Array.from(inner.querySelectorAll("col"));
    const table = inner.querySelector<HTMLElement>("table");
    const widths: number[] = [];
    for (let i = 0; i < colCount; i++) {
      const w = (metrics.colX[i + 1] ?? 0) - (metrics.colX[i] ?? 0);
      widths[i] = Math.max(MIN_COL, Math.round(w) || Math.round(metrics.w / colCount));
      if (cols[i]) cols[i].style.width = `${widths[i]}px`;
    }
    const total = () => widths.reduce((a, b) => a + b, 0);
    if (table) table.style.width = `${total()}px`;
    const startX = e.clientX;
    const startW = widths[colIndex];
    draggingRef.current = true;
    setHover(null);
    const onMove = (ev: PointerEvent) => {
      widths[colIndex] = Math.max(MIN_COL, Math.round(startW + (ev.clientX - startX)));
      if (cols[colIndex]) cols[colIndex].style.width = `${widths[colIndex]}px`;
      if (table) table.style.width = `${total()}px`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      onPatch({ tableColWidths: widths });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const startRowResize = (
    e: React.PointerEvent,
    group: BodyGroup,
    rowIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const inner = innerRef.current;
    if (!inner || !metrics) return;
    const tr = inner.querySelector<HTMLElement>(
      `tr[data-rgroup="${group}"][data-ridx="${rowIndex}"]`,
    );
    if (!tr) return;
    const rg = metrics.rows.find((r) => r.group === group);
    const startH = rg
      ? rg.ys[rowIndex + 1] - rg.ys[rowIndex]
      : tr.getBoundingClientRect().height;
    const startY = e.clientY;
    draggingRef.current = true;
    setHover(null);
    const onMove = (ev: PointerEvent) => {
      tr.style.height = `${Math.max(MIN_ROW, Math.round(startH + (ev.clientY - startY)))}px`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      const rgTrs = Array.from(
        inner.querySelectorAll<HTMLElement>(`tr[data-rgroup="${group}"]`),
      );
      const heights = rgTrs.map((t) => Math.round(t.getBoundingClientRect().height));
      onPatch({
        tableRowHeights: { ...(field.tableRowHeights ?? {}), [group]: heights },
      });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  if (!metrics) return null;

  return (
    <>
      {hover?.kind === "col" && (
        <div
          className={`dz-bctl dz-bctl-col${
            hover.idx === 0
              ? " is-first"
              : hover.idx === colCount
                ? " is-last"
                : ""
          }`}
          // `top: 0` anchors the vertical control to the table's top edge; without
          // it the absolutely-positioned container falls to its static flow slot
          // (after the table) and the line/grip/"+" render below the table.
          style={{ left: hover.x, top: 0, height: metrics.h }}
        >
          <span className="dz-bctl-line" />
          {hover.idx >= 1 && (
            <span
              className="dz-bctl-grip"
              title="Drag to resize column"
              onPointerDown={(e) => startColResize(e, hover.idx - 1)}
            />
          )}
          <button
            type="button"
            className="dz-bctl-add"
            title="Insert column"
            onPointerDown={(e) => e.stopPropagation()}
            // Clear the hover after inserting so the control doesn't linger on
            // top of the freshly added column (its grip / "+" would otherwise
            // intercept the click when the user goes to edit that new cell).
            onClick={() => {
              onPatch(insertColumn(field, hover.idx));
              setHover(null);
            }}
          >
            +
          </button>
        </div>
      )}
      {hover?.kind === "row" && (
        <div className="dz-bctl dz-bctl-row" style={{ top: hover.y, width: metrics.w }}>
          <span className="dz-bctl-line" />
          {hover.idx >= 1 && (
            <span
              className="dz-bctl-grip"
              title="Drag to resize row"
              onPointerDown={(e) => startRowResize(e, hover.group, hover.idx - 1)}
            />
          )}
          <button
            type="button"
            className="dz-bctl-add"
            title="Insert row"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              onPatch(insertRow(field, hover.group, hover.idx));
              setHover(null);
            }}
          >
            +
          </button>
        </div>
      )}
    </>
  );
}
