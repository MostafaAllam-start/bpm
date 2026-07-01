// Renderer for the display-table field. Two data sources, mirroring the choice
// fields: "manual" (hand-entered headers/cells) and "api" (rows fetched from a
// remote endpoint, optionally bracketed by manual top/bottom rows). Every manual
// header and cell may embed `{variable}` tokens, resolved at render time against
// the form/process scope — so a cell can read "Total: {order_total}". In the
// designer canvas no scope is supplied, so tokens stay visible as bindings.

import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../../utils/fieldTypes";
import type { LocalizedText, TableCellGroup } from "../../types";
import { resolveText } from "../../utils/text";
import { interpolate } from "../../utils/interpolation";
import { useTableRows } from "./useTableRows";
import { tableCellKey } from "./cellStyle";

export function TableField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const field = p.field;
  const cols = field.tableColumns ?? [];
  const isApi = field.tableSource === "api";
  const { rows: apiRows, loading, error } = useTableRows(field);

  // Resolve a localizable cell to text, then fill in any `{variable}` tokens.
  const resolve = (cell: LocalizedText | undefined): string =>
    interpolate(resolveText(cell, p.locale), p.scope);
  // A body row tagged by source: manual cells carry author HTML (rich-text from
  // the inline cell editor) and a style group/index so per-cell styles resolve;
  // API cells are plain text from the endpoint and carry no per-cell style.
  type BodyRow = {
    html: boolean;
    cells: string[];
    group?: TableCellGroup;
    rowIndex?: number;
  };
  // Turn a manual row set into resolved cells, aligned to the columns.
  const manual = (
    rows: LocalizedText[][] | undefined,
    group: TableCellGroup,
  ): BodyRow[] =>
    (rows ?? []).map((row, rowIndex) => ({
      html: true,
      group,
      rowIndex,
      cells: cols.map((_, c) => resolve(row[c])),
    }));

  // Resolve a cell's stored style overrides to a CSS object (or undefined).
  const cellStyle = (
    group: TableCellGroup,
    row: number,
    col: number,
  ): CSSProperties | undefined => {
    const s = field.tableCellStyles?.[tableCellKey(group, row, col)];
    if (!s || (!s.bg && !s.borderColor && s.borderWidth == null)) return undefined;
    return {
      ...(s.bg ? { backgroundColor: s.bg } : {}),
      ...(s.borderColor ? { borderColor: s.borderColor } : {}),
      ...(s.borderWidth != null
        ? { borderWidth: `${s.borderWidth}px`, borderStyle: "solid" }
        : {}),
    };
  };

  const headers = cols.map((c) => resolve(c));
  const bodyRows: BodyRow[] = isApi
    ? [
        ...manual(field.tableTopRows, "top"),
        ...apiRows.map((cells) => ({ html: false, cells })),
        ...manual(field.tableBottomRows, "bottom"),
      ]
    : manual(field.tableRows, "rows");

  if (cols.length === 0 && bodyRows.length === 0 && !loading && !error) {
    return <div className="ff-embed-empty">{field.type}</div>;
  }

  const showHead = field.tableHeader !== false && cols.length > 0;
  // API rows carry one cell per configured key; render against the column count.
  const colCount = cols.length;

  return (
    <div
      className={`ff-table-wrap${field.tableAutoHeight ? " is-auto-height" : ""}`}
    >
      <table className="ff-table">
        {showHead && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                // Headers are always manual: render as HTML so rich-text
                // formatting from the inline cell editor displays.
                <th
                  key={i}
                  dir="auto"
                  style={cellStyle("h", 0, i)}
                  dangerouslySetInnerHTML={{ __html: h }}
                />
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: colCount }, (_, c) => {
                const style =
                  row.group !== undefined && row.rowIndex !== undefined
                    ? cellStyle(row.group, row.rowIndex, c)
                    : undefined;
                return row.html ? (
                  <td
                    key={c}
                    dir="auto"
                    style={style}
                    dangerouslySetInnerHTML={{ __html: row.cells[c] ?? "" }}
                  />
                ) : (
                  <td key={c} style={style}>
                    {row.cells[c] ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {isApi && (loading || error) && (
        <div className="ff-table-feedback">
          {loading && <p className="ff-hint">{t("designer.table.loading")}</p>}
          {error && (
            <p className="ff-error">{t("designer.table.error", { error })}</p>
          )}
        </div>
      )}
    </div>
  );
}
