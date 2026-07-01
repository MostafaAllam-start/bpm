// In-place editor for the display-table field: renders the table grid with each
// manual header and body cell as a contentEditable, so the author edits cells
// directly on the canvas exactly like the heading / dynamic-text fields. Cells
// share the floating TextFormatToolbar (it attaches to any focused
// [contenteditable]) and the same toolbar-aware blur as InlineEditor, so a cell
// doesn't commit when focus moves to the toolbar.
//
// Focusing a cell records it as the table's selected cell (store.tableSelection)
// so the property panel can edit that cell's / column's / row's properties.
// Per-cell styles persist in `field.tableCellStyles`, keyed per cell.
//
// Only the manual arrays are editable here — the header (`tableColumns`) and the
// manual body rows (`tableRows` for a manual source; `tableTopRows` /
// `tableBottomRows` that bracket an API source). API-fetched rows aren't editable
// and are omitted from this surface.

import { useEffect, useRef } from "react";

import type { FormField, TableCellGroup, TableCellStyle } from "../types";
import { getLocaleText, setLocaleText } from "../utils/text";
import { tableCellKey } from "../fields/TableField";
import { useDesigner, useDesignerStoreApi } from "./designerStore";
import { caretAtPoint } from "./caretFromPoint";

type ManualRowsKey = "tableRows" | "tableTopRows" | "tableBottomRows";

const GROUP_OF: Record<ManualRowsKey, TableCellGroup> = {
  tableRows: "rows",
  tableTopRows: "top",
  tableBottomRows: "bottom",
};

type CellLoc = { group: TableCellGroup; row: number; col: number };

// A single contentEditable table cell. Sets its HTML once (and whenever the
// stored value/locale changes) imperatively, because React children and
// contentEditable don't mix. Commits its innerHTML on blur unless focus moved
// into the format toolbar (which would otherwise unmount/discard the edit).
// Carries its per-cell background / border overrides and reports focus so the
// property panel can target it.
function EditableCell({
  as: Tag,
  initialHtml,
  loc,
  style,
  active,
  onCommit,
  onActivate,
}: {
  as: "th" | "td";
  initialHtml: string;
  loc: CellLoc;
  style?: TableCellStyle;
  active: boolean;
  onCommit: (html: string) => void;
  onActivate: (loc: CellLoc) => void;
}) {
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const commit = (e: React.FocusEvent) => {
    // relatedTarget is the element gaining focus; native controls can report it
    // as null, so fall back to document.activeElement (see InlineEditor).
    const next =
      (e.relatedTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    if (next?.closest?.(".tf-toolbar")) return;
    if (ref.current) onCommit(ref.current.innerHTML);
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`dz-inline-editor dz-lc-nodrag${active ? " is-active-cell" : ""}`}
      dir="auto"
      style={{
        backgroundColor: style?.bg,
        borderColor: style?.borderColor,
        borderWidth: style?.borderWidth != null ? `${style.borderWidth}px` : undefined,
        borderStyle: style?.borderWidth != null ? "solid" : undefined,
      }}
      onFocus={() => onActivate(loc)}
      onBlur={commit}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Also activate on pointer-down: re-clicking the already-focused cell
        // won't fire onFocus, and this makes the property panel reliably track
        // whichever cell the author last touched.
        onActivate(loc);
      }}
      // Allow Enter for multi-line; keep keystrokes from bubbling to canvas
      // shortcuts. Escape exits edit mode (handled on the wrapper).
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }}
    />
  );
}

export default function TableInlineEditor({
  field,
  editingLocale,
  primaryLang,
  initialPoint,
  onExit,
}: {
  field: FormField;
  editingLocale: string;
  primaryLang: string;
  initialPoint?: { x: number; y: number };
  onExit: () => void;
}) {
  const store = useDesignerStoreApi();
  const rootRef = useRef<HTMLDivElement>(null);
  const selection = useDesigner((s) => s.tableSelection);

  const cols = field.tableColumns ?? [];
  const colCount = cols.length;
  const isApi = field.tableSource === "api";
  const showHead = field.tableHeader !== false && colCount > 0;
  const cellStyles = field.tableCellStyles ?? {};

  const isActive = (loc: CellLoc) =>
    selection?.fieldName === field.name &&
    selection.group === loc.group &&
    selection.row === loc.row &&
    selection.col === loc.col;

  const activate = (loc: CellLoc) =>
    store.getState().setTableSelection({ fieldName: field.name, ...loc });

  useEffect(() => {
    // Match InlineEditor: emit <span style> (not <font>) and <div> separators so
    // the shared toolbar's commands produce styling that survives commit.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("defaultParagraphSeparator", false, "div");
    // Focus the cell under the original click point and drop the caret there so
    // a single click straight into a cell starts editing it.
    if (!initialPoint) return;
    const target = document.elementFromPoint(
      initialPoint.x,
      initialPoint.y,
    ) as HTMLElement | null;
    const cell = target?.closest?.(".dz-inline-editor") as HTMLElement | null;
    if (!cell) return;
    cell.focus();
    const range = caretAtPoint(initialPoint.x, initialPoint.y, cell);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateHeader = (c: number, html: string) => {
    const next = cols.map((cell, ci) =>
      ci === c ? setLocaleText(cell, editingLocale, html, primaryLang) : cell,
    );
    store.getState().updateField(field.name, { tableColumns: next });
  };

  const updateCell = (key: ManualRowsKey, r: number, c: number, html: string) => {
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
    const patch: Partial<FormField> = { [key]: next };
    store.getState().updateField(field.name, patch);
  };

  // Exit edit mode when focus leaves this field's widget for something that isn't
  // a cell or the format toolbar (clicking the canvas, the property panel, etc.).
  // The focused cell first commits its text on blur, and the store's
  // tableSelection persists past exit — so the property panel keeps editing that
  // cell and the preview updates live without staying in inline-edit mode.
  const handleBlur = (e: React.FocusEvent) => {
    const next =
      (e.relatedTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    if (next && next.closest(".tf-toolbar")) return;
    const widget = rootRef.current?.closest(".dz-lc");
    if (next && widget && widget.contains(next)) return;
    onExit();
  };

  const renderManualRows = (key: ManualRowsKey) =>
    (field[key] ?? []).map((row, r) => (
      <tr key={`${key}-${r}`}>
        {Array.from({ length: colCount }, (_, c) => {
          const loc: CellLoc = { group: GROUP_OF[key], row: r, col: c };
          return (
            <EditableCell
              key={c}
              as="td"
              loc={loc}
              style={cellStyles[tableCellKey(loc.group, loc.row, loc.col)]}
              active={isActive(loc)}
              initialHtml={getLocaleText(row[c], editingLocale)}
              onCommit={(html) => updateCell(key, r, c, html)}
              onActivate={activate}
            />
          );
        })}
      </tr>
    ));

  return (
    <div
      ref={rootRef}
      className={`ff-table-wrap dz-table-editor${
        field.tableAutoHeight ? " is-auto-height" : ""
      }`}
      // Re-enable pointer/selection: the parent .dz-lc-body disables both to keep
      // the preview inert (see InlineEditor); the editable grid needs them back.
      style={{ pointerEvents: "auto", userSelect: "text" }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onExit();
        }
      }}
    >
      <table className="ff-table">
        {showHead && (
          <thead>
            <tr>
              {cols.map((c, i) => {
                const loc: CellLoc = { group: "h", row: 0, col: i };
                return (
                  <EditableCell
                    key={i}
                    as="th"
                    loc={loc}
                    style={cellStyles[tableCellKey("h", 0, i)]}
                    active={isActive(loc)}
                    initialHtml={getLocaleText(c, editingLocale)}
                    onCommit={(html) => updateHeader(i, html)}
                    onActivate={activate}
                  />
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {isApi ? (
            <>
              {renderManualRows("tableTopRows")}
              {renderManualRows("tableBottomRows")}
            </>
          ) : (
            renderManualRows("tableRows")
          )}
        </tbody>
      </table>
    </div>
  );
}
