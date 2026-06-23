// Geometry for the visual layout builder: grid/snapping math, sensible default
// sizes per field type, backward-compatible migration of legacy (flow-only)
// schemas into absolute boxes, and helpers for placement, bounds, and hit
// testing. Pure functions — no React, no store — so they're easy to test and
// reuse from both the designer and the runtime renderer.

import type { Breakpoint, ColSpan, FormField, FormSchema, LayoutBox } from "../types";
import { getFieldType } from "../utils/fieldTypes";

// Snap grid: 20px, as specced. Used for both drag and resize when snap is on.
export const GRID_SIZE = 20;

// Minimum container dimensions, enforced on resize so a widget never collapses.
export const MIN_WIDTH = 80;
export const MIN_HEIGHT = 44;

// The form's default design width and the page's inner padding / inter-field
// gap used when packing a legacy form into absolute boxes.
export const DEFAULT_CANVAS_WIDTH = 960;
export const PAGE_PADDING = 24;
export const FIELD_GAP = 16;

// Column grid for `col`-unit field widths (CanvasSettings.columns). Field widths
// can snap to / are capped at this many columns across the form's content area.
export const DEFAULT_COLUMNS = 12;
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 24;

export function clampColumns(n: number | undefined): number {
  const v = Math.round(n ?? DEFAULT_COLUMNS);
  if (!Number.isFinite(v)) return DEFAULT_COLUMNS;
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, v));
}

// The form's configured column count (defaulting to 12), clamped to a sane range.
export function formColumns(schema: FormSchema): number {
  return clampColumns(schema.canvas?.columns);
}

// Zoom limits and step for the viewport controls.
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 1.2;

const COLUMN_COUNT = 12;
const BREAKPOINT_ORDER: Breakpoint[] = ["base", "sm", "md", "lg", "xl"];

// ── Snapping ──────────────────────────────────────────────────────────────

export function snapValue(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

export function snapPoint(
  x: number,
  y: number,
  grid = GRID_SIZE,
): { x: number; y: number } {
  return { x: snapValue(x, grid), y: snapValue(y, grid) };
}

// Snap every edge of a box to the grid (position and the far edges, so width and
// height also land on grid lines).
export function snapBox(box: LayoutBox, grid = GRID_SIZE): LayoutBox {
  const x = snapValue(box.x, grid);
  const y = snapValue(box.y, grid);
  return {
    ...box,
    x,
    y,
    width: Math.max(grid, snapValue(box.x + box.width, grid) - x),
    height: Math.max(grid, snapValue(box.y + box.height, grid) - y),
  };
}

// Enforce minimum size and keep the box on the page (non-negative origin).
export function clampBox(box: LayoutBox): LayoutBox {
  return {
    ...box,
    x: Math.max(0, Math.round(box.x)),
    y: Math.max(0, Math.round(box.y)),
    width: Math.max(MIN_WIDTH, Math.round(box.width)),
    height: Math.max(MIN_HEIGHT, Math.round(box.height)),
  };
}

// ── Default sizing ──────────────────────────────────────────────────────────

// The effective desktop column span for a field: the value at the widest
// defined breakpoint (base → xl, each inheriting the previous), defaulting to a
// full 12. Used to reproduce the responsive grid when migrating to absolute.
function effectiveColSpan(colSpan: ColSpan | undefined): number {
  if (!colSpan) return COLUMN_COUNT;
  let span = COLUMN_COUNT;
  for (const bp of BREAKPOINT_ORDER) {
    const v = colSpan[bp];
    if (v != null) span = v;
  }
  return Math.max(1, Math.min(COLUMN_COUNT, span));
}

// A reasonable starting height (px) for a field, so a migrated/added widget is
// tall enough to show its control without manual resizing.
export function defaultFieldHeight(field: FormField): number {
  const def = getFieldType(field.type);
  const labelled = def?.group !== "display"; // inputs/choices carry a label row
  const labelRow = labelled ? 28 : 0;
  switch (field.type) {
    case "comment":
      return labelRow + 112;
    case "checkbox":
    case "radiogroup": {
      const rows = field.choices?.length ?? 3;
      return labelRow + 16 + rows * 30;
    }
    case "boolean":
      return labelRow + 36;
    case "signature":
      return labelRow + 160;
    case "signatureupload":
      return labelRow + 320;
    case "imageupload":
    case "fileupload":
      return labelRow + 112;
    case "image":
      return (field.height ?? 200) + 8;
    case "iframe":
      return (field.height ?? 320) + 8;
    case "html":
      return 72;
    case "group":
      return 220; // a roomy section box to drop a few fields into
    case "table": {
      const bodyRows = field.tableRows?.length ?? 2;
      const headerRows = field.tableHeader === false ? 0 : 1;
      return 16 + (bodyRows + headerRows) * 38;
    }
    case "rating":
      return labelRow + 44;
    default:
      return labelRow + 44; // single-line text, email, number, date, datetime
  }
}

// ── Migration: legacy flow schema → absolute boxes ──────────────────────────

// Pack fields that lack a `layout` into stacked rows on a 12-column grid,
// reproducing their responsive widths so a migrated form *looks* like it did
// before the visual designer. Fields that already carry a layout are left as-is.
// Returns the same schema object when every field already has a layout.
export function ensureLayout(schema: FormSchema): FormSchema {
  const canvasWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
  let changed = false;
  let maxBottom = PAGE_PADDING;

  const pages = schema.pages.map((page) => {
    const colWidth = (canvasWidth - PAGE_PADDING * 2) / COLUMN_COUNT;
    let col = 0;
    let rowY = PAGE_PADDING;
    let rowHeight = 0;

    const elements = page.elements.map((el, index) => {
      if (el.layout) {
        maxBottom = Math.max(maxBottom, el.layout.y + el.layout.height);
        return el;
      }
      changed = true;
      const span = effectiveColSpan(el.colSpan);
      if (col + span > COLUMN_COUNT) {
        col = 0;
        rowY += rowHeight + FIELD_GAP;
        rowHeight = 0;
      }
      const height = defaultFieldHeight(el);
      const layout: LayoutBox = {
        x: Math.round(PAGE_PADDING + col * colWidth),
        y: Math.round(rowY),
        width: Math.round(span * colWidth - FIELD_GAP),
        height,
        zIndex: index + 1,
      };
      col += span;
      rowHeight = Math.max(rowHeight, height);
      maxBottom = Math.max(maxBottom, layout.y + layout.height);
      return { ...el, layout };
    });

    return changed ? { ...page, elements } : page;
  });

  if (!changed && schema.canvas) return schema;
  return {
    ...schema,
    pages,
    canvas: {
      width: canvasWidth,
      height: Math.max(
        schema.canvas?.height ?? 0,
        Math.round(maxBottom + PAGE_PADDING),
      ),
    },
  };
}

// ── Placement & bounds ──────────────────────────────────────────────────────

export function nextZIndex(fields: FormField[]): number {
  return fields.reduce((max, f) => Math.max(max, f.layout?.zIndex ?? 0), 0) + 1;
}

// Bounding box of all laid-out fields (canvas space). Returns null when empty.
export function contentBounds(
  fields: FormField[],
): { x: number; y: number; width: number; height: number } | null {
  const boxes = fields.map((f) => f.layout).filter(Boolean) as LayoutBox[];
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// A box for a newly added field. With a drop point, place a default-sized widget
// there (snapped, kept on the page); otherwise stack a full-width widget below
// the existing content, mirroring the old click-to-append behavior.
export function placeNewField(
  fields: FormField[],
  field: FormField,
  canvasWidth: number,
  at?: { x: number; y: number },
  snap = true,
): LayoutBox {
  const zIndex = nextZIndex(fields);
  const height = defaultFieldHeight(field);
  if (at) {
    const width = Math.min(360, canvasWidth - PAGE_PADDING * 2);
    let x = at.x - width / 2;
    let y = at.y - height / 2;
    if (snap) {
      x = snapValue(x);
      y = snapValue(y);
    }
    x = Math.max(0, Math.min(x, canvasWidth - width));
    y = Math.max(0, y);
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height, zIndex };
  }
  const bounds = contentBounds(fields);
  const y = bounds ? bounds.y + bounds.height + FIELD_GAP : PAGE_PADDING;
  return {
    x: PAGE_PADDING,
    y: Math.round(y),
    width: Math.round(canvasWidth - PAGE_PADDING * 2),
    height,
    zIndex,
  };
}

// Default placement for the form's submit button: a normal-sized button below
// the content, at the start of the page.
export function defaultSubmitLayout(fields: FormField[]): LayoutBox {
  const bounds = contentBounds(fields);
  const y = bounds ? bounds.y + bounds.height + FIELD_GAP * 2 : PAGE_PADDING;
  return {
    x: PAGE_PADDING,
    y: Math.round(y),
    width: 180,
    height: 44,
    zIndex: nextZIndex(fields) + 1,
  };
}

// Default placement for the form's title: a full-width banner pinned to the top
// of the page, above the content.
export function defaultTitleLayout(canvasWidth: number): LayoutBox {
  return {
    x: PAGE_PADDING,
    y: PAGE_PADDING,
    width: Math.max(MIN_WIDTH, Math.round(canvasWidth - PAGE_PADDING * 2)),
    height: 48,
    // Above the page surface; field/submit z-indices start at 1 and climb.
    zIndex: 1,
  };
}

// Bottom edge (max y + height) of a set of layout boxes; 0 when empty. Used to
// size the canvas page / runtime stage so it contains all content.
export function boxesBottom(boxes: (LayoutBox | undefined)[]): number {
  let bottom = 0;
  for (const box of boxes) if (box) bottom = Math.max(bottom, box.y + box.height);
  return bottom;
}

// ── Hit testing ──────────────────────────────────────────────────────────────

export type Rect = { x: number; y: number; width: number; height: number };

// Is a point inside a box?
function pointInBox(p: { x: number; y: number }, b: LayoutBox): boolean {
  return (
    p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
  );
}

// The topmost (highest zIndex) field whose box contains the point — i.e. the
// field a drop landed on. Returns undefined when the point is over bare canvas.
export function findItemAt(
  fields: FormField[],
  point: { x: number; y: number },
): FormField | undefined {
  let best: FormField | undefined;
  for (const f of fields) {
    if (
      f.layout &&
      pointInBox(point, f.layout) &&
      (!best || f.layout.zIndex > (best.layout?.zIndex ?? 0))
    ) {
      best = f;
    }
  }
  return best;
}

// After a field is resized larger, push the items below it down so the grown
// field doesn't overlap them. `items` is every layout item (fields + submit)
// with the resized field already at its new box; `anchorName` is that field,
// which never moves. Only items whose top starts at or below the anchor's top
// are candidates, and they only ever move DOWN — and only when they'd actually
// overlap an item above them — so shrinking the field leaves the others where
// they were. Cascades, so a push ripples down a stack. Returns a map of
// name → new layout for just the items that shifted.
export function reflowBelow(
  items: { name: string; layout: LayoutBox }[],
  anchorName: string,
  gap = FIELD_GAP,
): Map<string, LayoutBox> {
  const moved = new Map<string, LayoutBox>();
  const anchor = items.find((it) => it.name === anchorName);
  if (!anchor) return moved;

  const at = (it: { name: string; layout: LayoutBox }): LayoutBox =>
    moved.get(it.name) ?? it.layout;

  // Candidates below the anchor, nearest first, so a push cascades down.
  const below = items
    .filter((it) => it.name !== anchorName && it.layout.y >= anchor.layout.y)
    .sort((p, q) => p.layout.y - q.layout.y);

  for (let k = 0; k < below.length; k++) {
    const box = below[k].layout;
    // Items that can push this one down: the anchor and the candidates already
    // placed above it this pass.
    const uppers = [anchor, ...below.slice(0, k)];
    let top = box.y;
    for (const up of uppers) {
      const u = at(up);
      const xOverlap = box.x < u.x + u.width && box.x + box.width > u.x;
      if (!xOverlap) continue;
      // Only when they'd actually overlap vertically — keep existing clearance.
      if (top < u.y + u.height) top = Math.max(top, u.y + u.height + gap);
    }
    if (top !== box.y) moved.set(below[k].name, { ...box, y: top });
  }
  return moved;
}

// Pack fields into rows that flow left-to-right and wrap: each field keeps its
// own width and height; it starts a new row when it no longer fits in the
// current one (within [left, right], counting `gapX` between fields). Rows stack
// top-to-bottom separated by `gapY`, and fields in a row share the row's top.
// At least one field is placed per row even if it's wider than the row. Returns
// name → {x, y}. This is what lets fields sit side by side when there's room and
// wrap to the next row when there isn't.
export function packRows(
  order: { name: string; layout: LayoutBox }[],
  left: number,
  right: number,
  top: number,
  gapX: number,
  gapY: number,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  let x = left;
  let y = top;
  let rowHeight = 0;
  // True only for the very first field, so a field wider than the row still gets
  // placed (at the left) instead of wrapping to an empty row. After a wrap the
  // field is placed unconditionally, so no other field needs this guard.
  let rowStart = true;
  for (const it of order) {
    const w = it.layout.width;
    if (!rowStart && x + w > right + 0.5) {
      // Doesn't fit in the current row → wrap to a new one.
      y += rowHeight + gapY;
      x = left;
      rowHeight = 0;
    }
    pos.set(it.name, { x: Math.round(x), y: Math.round(y) });
    x += w + gapX;
    rowHeight = Math.max(rowHeight, it.layout.height);
    rowStart = false;
  }
  return pos;
}

// Horizontal mirror of reflowBelow: after a field is resized wider to the right,
// push the items to its right further right so it doesn't overlap them. Only
// items starting at or right of the anchor's left edge are candidates; they only
// move RIGHT, and only when they'd actually overlap. Cascades rightward.
export function reflowRight(
  items: { name: string; layout: LayoutBox }[],
  anchorName: string,
  gap = FIELD_GAP,
): Map<string, LayoutBox> {
  const moved = new Map<string, LayoutBox>();
  const anchor = items.find((it) => it.name === anchorName);
  if (!anchor) return moved;

  const at = (it: { name: string; layout: LayoutBox }): LayoutBox =>
    moved.get(it.name) ?? it.layout;

  const right = items
    .filter((it) => it.name !== anchorName && it.layout.x >= anchor.layout.x)
    .sort((p, q) => p.layout.x - q.layout.x);

  for (let k = 0; k < right.length; k++) {
    const box = right[k].layout;
    const lefts = [anchor, ...right.slice(0, k)];
    let x = box.x;
    for (const lf of lefts) {
      const l = at(lf);
      const yOverlap = box.y < l.y + l.height && box.y + box.height > l.y;
      if (!yOverlap) continue;
      if (x < l.x + l.width) x = Math.max(x, l.x + l.width + gap);
    }
    if (x !== box.x) moved.set(right[k].name, { ...box, x });
  }
  return moved;
}

// Horizontal mirror of reflowAbove for a field whose LEFT edge is dragged left:
// push the items to its left further left (clamped at `minX`) so it doesn't
// overlap them. Cascades leftward.
export function reflowLeft(
  items: { name: string; layout: LayoutBox }[],
  anchorName: string,
  gap = FIELD_GAP,
  minX = 0,
): Map<string, LayoutBox> {
  const moved = new Map<string, LayoutBox>();
  const anchor = items.find((it) => it.name === anchorName);
  if (!anchor) return moved;

  const at = (it: { name: string; layout: LayoutBox }): LayoutBox =>
    moved.get(it.name) ?? it.layout;

  const anchorRight = anchor.layout.x + anchor.layout.width;
  const left = items
    .filter(
      (it) =>
        it.name !== anchorName && it.layout.x + it.layout.width <= anchorRight,
    )
    .sort((p, q) => q.layout.x + q.layout.width - (p.layout.x + p.layout.width));

  for (let k = 0; k < left.length; k++) {
    const box = left[k].layout;
    const rights = [anchor, ...left.slice(0, k)];
    let x = box.x;
    for (const rt of rights) {
      const r = at(rt);
      const yOverlap = box.y < r.y + r.height && box.y + box.height > r.y;
      if (!yOverlap) continue;
      if (x + box.width > r.x) x = Math.min(x, r.x - gap - box.width);
    }
    x = Math.max(minX, x);
    if (x !== box.x) moved.set(left[k].name, { ...box, x });
  }
  return moved;
}

// Mirror of reflowBelow for a field whose TOP edge is dragged up: push the items
// above it up so the grown field doesn't overlap them. Only items whose bottom
// is at or above the anchor's bottom are candidates; they only ever move UP, and
// only when they'd actually overlap. Cascades upward and clamps at `minY` so
// nothing is pushed off the top of the page.
export function reflowAbove(
  items: { name: string; layout: LayoutBox }[],
  anchorName: string,
  gap = FIELD_GAP,
  minY = PAGE_PADDING,
): Map<string, LayoutBox> {
  const moved = new Map<string, LayoutBox>();
  const anchor = items.find((it) => it.name === anchorName);
  if (!anchor) return moved;

  const at = (it: { name: string; layout: LayoutBox }): LayoutBox =>
    moved.get(it.name) ?? it.layout;

  const anchorBottom = anchor.layout.y + anchor.layout.height;
  // Candidates above the anchor, nearest first (largest bottom edge), so a push
  // cascades up the stack.
  const above = items
    .filter(
      (it) =>
        it.name !== anchorName && it.layout.y + it.layout.height <= anchorBottom,
    )
    .sort((p, q) => q.layout.y + q.layout.height - (p.layout.y + p.layout.height));

  for (let k = 0; k < above.length; k++) {
    const box = above[k].layout;
    // Items that can push this one up: the anchor and the candidates already
    // placed below it this pass.
    const lowers = [anchor, ...above.slice(0, k)];
    let top = box.y;
    for (const lo of lowers) {
      const l = at(lo);
      const xOverlap = box.x < l.x + l.width && box.x + box.width > l.x;
      if (!xOverlap) continue;
      // Only when they'd actually overlap vertically — keep existing clearance.
      if (top + box.height > l.y) top = Math.min(top, l.y - gap - box.height);
    }
    top = Math.max(minY, top);
    if (top !== box.y) moved.set(above[k].name, { ...box, y: top });
  }
  return moved;
}

// Cluster boxes into horizontal rows (groups whose vertical extents overlap) and
// return each row's top/bottom, sorted top-to-bottom. Used to draw the row guide
// lines shown while dragging a field.
export function rowBands(boxes: LayoutBox[]): { top: number; bottom: number }[] {
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  const bands: { top: number; bottom: number }[] = [];
  for (const b of sorted) {
    const last = bands[bands.length - 1];
    if (last && b.y < last.bottom) {
      // Vertically overlaps the current band → same row.
      last.bottom = Math.max(last.bottom, b.y + b.height);
    } else {
      bands.push({ top: b.y, bottom: b.y + b.height });
    }
  }
  return bands;
}

// The names of the fields visually contained in `box`: a field belongs to a
// group section when its centre point falls inside the group's box. Group
// containers themselves and `exclude` (the group) are skipped. Shared by the
// store ("move the section → move its fields") and the runtime collapse.
export function fieldsInBox(
  fields: FormField[],
  box: LayoutBox,
  exclude?: string,
): string[] {
  const out: string[] = [];
  for (const f of fields) {
    if (!f.layout || f.type === "group" || f.name === exclude) continue;
    const cx = f.layout.x + f.layout.width / 2;
    const cy = f.layout.y + f.layout.height / 2;
    if (
      cx >= box.x &&
      cx <= box.x + box.width &&
      cy >= box.y &&
      cy <= box.y + box.height
    ) {
      out.push(f.name);
    }
  }
  return out;
}

// A group section's header strip (px) and inner padding (px). The header is
// reserved at the top of the box for the title; fields sit below it within the
// padding.
export const GROUP_HEADER = 40;
export const GROUP_PAD = 12;
const MIN_GROUP_HEIGHT = 96;

// Does a localized title carry any non-empty text (in any locale)?
function titleHasText(title: FormField["title"]): boolean {
  if (title == null) return false;
  if (typeof title === "string") return title.trim() !== "";
  return Object.values(title).some((v) => typeof v === "string" && v.trim() !== "");
}

// The header strip height a group reserves: the full header when it shows a
// title or a collapse toggle (collapsible), otherwise just the inner padding —
// so an untitled, non-collapsible section gives its fields the whole box and
// nothing is reserved for a header that isn't drawn.
export function groupHeaderHeight(field: FormField): number {
  return field.collapsible || titleHasText(field.title) ? GROUP_HEADER : GROUP_PAD;
}

// The height a group box needs to contain its members (their lowest bottom edge
// plus the inner padding), never below a usable minimum so an empty section
// stays a droppable target. This is how a group "fits its content".
export function fittedGroupHeight(
  groupY: number,
  memberBoxes: LayoutBox[],
  headerH = GROUP_HEADER,
): number {
  const contentBottom = memberBoxes.reduce(
    (m, b) => Math.max(m, b.y + b.height),
    groupY + headerH,
  );
  return Math.max(MIN_GROUP_HEIGHT, Math.round(contentBottom - groupY + GROUP_PAD));
}

// Where a newly dropped field should land *inside* a group, sized to fit the
// space it was dropped in. If the drop point falls into an existing row that has
// a free horizontal segment ≥ MIN_WIDTH, the field takes that segment (so fields
// sit side by side within the row); otherwise it becomes a full-width row below
// the section's current content. `members` are the group's current members; the
// returned box's `zIndex` is a placeholder for the caller to set.
export function groupInsertBox(
  members: { layout: LayoutBox }[],
  group: LayoutBox,
  at: { x: number; y: number },
  gapX: number,
  gapY: number,
  height: number,
  headerH = GROUP_HEADER,
): LayoutBox {
  const innerLeft = group.x + GROUP_PAD;
  const innerRight = group.x + group.width - GROUP_PAD;
  const innerTop = group.y + headerH;
  const fullWidth = Math.max(MIN_WIDTH, Math.round(innerRight - innerLeft));

  // Members whose vertical span brackets the drop point — i.e. the row dropped
  // into (with a gap's tolerance above/below).
  const rowMembers = members.filter(
    (m) =>
      at.y >= m.layout.y - gapY && at.y <= m.layout.y + m.layout.height + gapY,
  );

  if (rowMembers.length) {
    const rowTop = Math.min(...rowMembers.map((m) => m.layout.y));
    // Occupied x-intervals in the row, then the free segments around them.
    const occupied = rowMembers
      .map((m) => [m.layout.x, m.layout.x + m.layout.width] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const free: [number, number][] = [];
    let prev = innerLeft;
    for (const [l, r] of occupied) {
      if (l - prev > 0) free.push([prev, l]);
      prev = Math.max(prev, r);
    }
    if (innerRight - prev > 0) free.push([prev, innerRight]);

    // Prefer the segment under the cursor, else the widest one.
    let seg = free.find(([l, r]) => at.x >= l && at.x <= r);
    if (!seg && free.length) {
      seg = free.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    }
    if (seg) {
      const leftPad = seg[0] > innerLeft ? gapX : 0;
      const rightPad = seg[1] < innerRight ? gapX : 0;
      const x = seg[0] + leftPad;
      const width = seg[1] - rightPad - x;
      if (width >= MIN_WIDTH) {
        return {
          x: Math.round(x),
          y: Math.round(rowTop),
          width: Math.round(width),
          height,
          zIndex: 0,
        };
      }
    }
  }

  // No room in a row (or dropped on empty space) → a full-width row below the
  // section's current content.
  const contentBottom = members.reduce(
    (m, it) => Math.max(m, it.layout.y + it.layout.height),
    innerTop - gapY,
  );
  const y = members.length ? contentBottom + gapY : innerTop;
  return {
    x: Math.round(innerLeft),
    y: Math.round(y),
    width: fullWidth,
    height,
    zIndex: 0,
  };
}

// Map each member field to the group section that owns it (the topmost when
// boxes overlap), by spatial containment.
function membersByGroup(
  elements: FormField[],
  groups: FormField[],
): Map<string, FormField> {
  const owner = new Map<string, FormField>();
  for (const g of groups) {
    for (const n of fieldsInBox(elements, g.layout!, g.name)) {
      const cur = owner.get(n);
      if (!cur || g.layout!.zIndex > cur.layout!.zIndex) owner.set(n, g);
    }
  }
  return owner;
}

// Clamp every member field so it stays inside its section: below the header (no
// overlaying the title), and never wider than — or hanging out of — the inner
// box (max width = section width − padding). Heights/positions are otherwise
// left alone. Returns a new array only when something changed.
export function clampMembersToGroups(elements: FormField[]): FormField[] {
  const groups = elements.filter((e) => e.type === "group" && e.layout);
  if (!groups.length) return elements;
  const owner = membersByGroup(elements, groups);
  let changed = false;
  const result = elements.map((e) => {
    const g = owner.get(e.name);
    if (!g || !e.layout || !g.layout) return e;
    const headerH = groupHeaderHeight(g);
    const innerLeft = g.layout.x + GROUP_PAD;
    const innerRight = g.layout.x + g.layout.width - GROUP_PAD;
    const innerWidth = Math.max(MIN_WIDTH, innerRight - innerLeft);
    const width = Math.round(Math.min(e.layout.width, innerWidth));
    const x = Math.round(Math.max(innerLeft, Math.min(e.layout.x, innerRight - width)));
    const y = Math.round(Math.max(g.layout.y + headerH, e.layout.y));
    if (width !== e.layout.width || x !== e.layout.x || y !== e.layout.y) {
      changed = true;
      return { ...e, layout: { ...e.layout, x, y, width } };
    }
    return e;
  });
  return changed ? result : elements;
}

// Cap any form-level field (one that is NOT a section, and not contained in a
// section — those are handled by clampMembersToGroups) so it can't be wider than
// the form's content area or hang off its right edge. This enforces "a field
// never exceeds the form width", mirroring the section clamp for the page.
// Returns a new array only when something changed.
export function clampFieldsToForm(
  elements: FormField[],
  canvasWidth: number,
): FormField[] {
  const groups = elements.filter((e) => e.type === "group" && e.layout);
  const members = groups.length
    ? new Set(membersByGroup(elements, groups).keys())
    : new Set<string>();
  const left = PAGE_PADDING;
  const right = Math.max(left + MIN_WIDTH, canvasWidth - PAGE_PADDING);
  const innerWidth = right - left;
  let changed = false;
  const result = elements.map((e) => {
    if (!e.layout || e.type === "group" || members.has(e.name)) return e;
    const width = Math.round(Math.min(e.layout.width, innerWidth));
    // Only nudge x when the field would otherwise stick out past the right edge;
    // a compliant field is left exactly where it is.
    const x = Math.round(Math.max(0, Math.min(e.layout.x, right - width)));
    if (width !== e.layout.width || x !== e.layout.x) {
      changed = true;
      return { ...e, layout: { ...e.layout, x, width } };
    }
    return e;
  });
  return changed ? result : elements;
}

// Clamp members (above) AND resize every group box to fit its (clamped) members
// (see fittedGroupHeight), returning a new array only when something changed.
// When `canvasWidth` is given, also cap form-level fields to the form's width
// (clampFieldsToForm). Call after a field is added to, removed from, or moved
// within/out of a section.
export function normalizeGroups(
  elements: FormField[],
  canvasWidth?: number,
): FormField[] {
  let work = clampMembersToGroups(elements);
  if (canvasWidth != null) work = clampFieldsToForm(work, canvasWidth);
  let changed = work !== elements;
  const result = work.map((e) => {
    if (e.type !== "group" || !e.layout) return e;
    const headerH = groupHeaderHeight(e);
    const boxes = fieldsInBox(work, e.layout, e.name)
      .map((n) => work.find((x) => x.name === n)?.layout)
      .filter(Boolean) as LayoutBox[];
    const height = fittedGroupHeight(e.layout.y, boxes, headerH);
    if (height !== e.layout.height) {
      changed = true;
      return { ...e, layout: { ...e.layout, height } };
    }
    return e;
  });
  return changed ? result : elements;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Normalize a rectangle defined by two corner points into x/y/width/height.
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Rect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(ax - bx),
    height: Math.abs(ay - by),
  };
}
