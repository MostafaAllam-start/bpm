// Renderer for the display-table field. Two data sources, mirroring the choice
// fields: "manual" (hand-entered headers/cells) and "api" (rows fetched from a
// remote endpoint, optionally bracketed by manual top/bottom rows). Every manual
// header and cell may embed `{variable}` tokens, resolved at render time against
// the form/process scope — so a cell can read "Total: {order_total}". In the
// designer canvas no scope is supplied, so tokens stay visible as bindings.

import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../utils/fieldTypes";
import type { LocalizedText } from "../types";
import { resolveText } from "../utils/text";
import { interpolate } from "../utils/interpolation";
import { useTableRows } from "./useTableRows";

export function TableField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const field = p.field;
  const cols = field.tableColumns ?? [];
  const isApi = field.tableSource === "api";
  const { rows: apiRows, loading, error } = useTableRows(field);

  // Resolve a localizable cell to text, then fill in any `{variable}` tokens.
  const resolve = (cell: LocalizedText | undefined): string =>
    interpolate(resolveText(cell, p.locale), p.scope);
  // Turn a manual row set into resolved strings, aligned to the columns.
  const manual = (rows: LocalizedText[][] | undefined): string[][] =>
    (rows ?? []).map((row) => cols.map((_, c) => resolve(row[c])));

  const headers = cols.map((c) => resolve(c));
  const bodyRows = isApi
    ? [...manual(field.tableTopRows), ...apiRows, ...manual(field.tableBottomRows)]
    : manual(field.tableRows);

  if (cols.length === 0 && bodyRows.length === 0 && !loading && !error) {
    return <div className="ff-embed-empty">{field.type}</div>;
  }

  const showHead = field.tableHeader !== false && cols.length > 0;
  // API rows carry one cell per configured key; render against the column count.
  const colCount = cols.length;

  return (
    <div className="ff-table-wrap">
      <table className="ff-table">
        {showHead && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: colCount }, (_, c) => (
                <td key={c}>{row[c] ?? ""}</td>
              ))}
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
