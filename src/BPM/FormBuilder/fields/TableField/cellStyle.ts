// Stable key for a per-cell style entry in `field.tableCellStyles`. The same key
// must be produced by the renderer (TableField) and the inline editor
// (TableInlineEditor) so a cell's style round-trips. `group` distinguishes the
// header ("h") from the manual body row sets ("rows" / "top" / "bottom");
// API-fetched rows have no stable identity and are never keyed.
import type { TableCellGroup } from "../../types";

export function tableCellKey(
  group: TableCellGroup,
  row: number,
  col: number,
): string {
  return `${group}:${row}:${col}`;
}
