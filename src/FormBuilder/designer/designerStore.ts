// The designer's state core: a Zustand (vanilla) store holding the form schema,
// the multi-selection, the canvas viewport (zoom/pan), grid/snap settings, and a
// full undo/redo history. Created per-editor instance and shared through React
// context (see DesignerStoreProvider / useDesigner). Every document mutation is
// immutable — actions replace the schema (and nested arrays/objects) with new
// references — so history snapshots are just retained references, no deep clone.

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  Breakpoint,
  CanvasSettings,
  FieldType,
  FormField,
  FormPage,
  FormSchema,
  FormTitle,
  LayoutBox,
  ThemeSettings,
} from "../types";
import { getFieldType } from "../utils/fieldTypes";
import {
  clearLayoutAt,
  resolveLayout,
  setLayoutAt,
} from "../utils/responsive";
import { ensureFieldIds, newFieldId, uniqueName } from "./ids";
import {
  clampBox,
  clampColumns,
  contentBounds,
  DEFAULT_CANVAS_WIDTH,
  defaultFieldHeight,
  defaultSubmitLayout,
  defaultTitleLayout,
  clampMembersToGroups,
  ensureLayout,
  fieldsInBox,
  FIELD_GAP,
  findItemAt,
  groupHeaderHeight,
  groupInsertBox,
  GRID_SIZE,
  MIN_WIDTH,
  nextZIndex,
  packRows,
  PAGE_PADDING,
  rectsIntersect,
  reflowAbove,
  reflowBelow,
  reflowLeft,
  reflowRight,
  normalizeGroups,
  snapBox,
  snapValue,
  type Rect,
} from "./canvasLayout";

// Margin (screen px) from the viewport top to the canvas page at zoom 1 — kept a
// little larger so the floating toolbar clears the page's top edge.
export const PAGE_MARGIN = 40;
// Tighter margin used when auto-fitting the page to the container, so the form
// fills the canvas (left/right/bottom) rather than floating with wide gutters.
export const FIT_MARGIN = 16;

// Reserved selection id for the form's submit button. It isn't a field (it has
// no entry in page.elements); the layout actions treat it as a first-class item
// so it can be moved/resized, but deletion/duplication skip it.
export const SUBMIT_NAME = "__submit__";

// Reserved selection id for the form's title. Like the submit button it's not a
// field — its placement/typography live on `schema.titleBox` (the text is on
// `schema.title`) — and the layout actions treat it as a movable/resizable item
// that can't be deleted or duplicated.
export const TITLE_NAME = "__title__";

// A point in viewport (CSS pixel) space relative to the canvas viewport element.
export type ScreenPoint = { x: number; y: number };

// One undoable document state: the schema plus the selection at that moment, so
// undo also restores what was selected.
type HistoryEntry = { schema: FormSchema; selection: string[] };

export type DesignerState = {
  // ── document ──
  schema: FormSchema;
  // ── selection (field names; the last entry is the "primary") ──
  selection: string[];
  // ── viewport (size only — the canvas renders 1:1 and scrolls on overflow) ──
  viewport: { width: number; height: number };
  // ── grid ──
  snap: boolean;
  gridSize: number;
  // ── guideline overlays (view-only, not part of the schema) ──
  // Whether the canvas draws the column grid and the row band guide lines.
  showColGuides: boolean;
  showRowGuides: boolean;
  // ── responsive: which breakpoint the canvas is currently designing ──
  // "base" edits the layout that applies to every screen; any other breakpoint
  // edits an override that cascades to it and larger screens.
  activeBreakpoint: Breakpoint;
  // ── history ──
  past: HistoryEntry[];
  future: HistoryEntry[];
  // internal: interaction baseline + history coalescing tag (not for UI use)
  _baseline: HistoryEntry | null;
  _coalesceTag: string | null;
  // internal: single-field sortable-drag session — the dragged field's name and
  // the slot (home box) it will settle into on drop.
  _dragName: string | null;
  _dragHome: LayoutBox | null;

  // ── document actions ──
  load: (schema: FormSchema) => void;
  addField: (
    type: FieldType,
    defaultTitle: string,
    at?: { x: number; y: number },
  ) => void;
  removeField: (name: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveField: (from: number, to: number) => void;
  updateField: (name: string, patch: Partial<FormField>) => void;
  renameField: (name: string, next: string) => boolean;
  updateForm: (patch: Partial<Pick<FormSchema, "title" | "description">>) => void;
  // Update the title's typography (size / family / weight / style / color); its
  // layout is edited through updateLayout(TITLE_NAME, …) like any other item.
  updateTitleStyle: (
    patch: Partial<Pick<FormTitle, "fontSize" | "fontFamily" | "bold" | "italic" | "color">>,
  ) => void;
  setTheme: (theme: ThemeSettings) => void;
  setCanvasSize: (size: Partial<CanvasSettings>) => void;
  // Set the form's default element spacing (px). Coalesced in history.
  setGap: (gap: { x?: number; y?: number }) => void;
  // Set how many columns the form's width is divided into for `col`-unit field
  // widths (1..24). Coalesced in history.
  setColumns: (columns: number) => void;
  // Set the form's max rendered width (px); undefined/0 clears it (no cap).
  // Coalesced in history.
  setMaxWidth: (maxWidth: number | undefined) => void;
  // Fit the page to `targetWidth`, scaling every field's x/width to match, so
  // an auto-width form fills the canvas. Not recorded in history (it's a layout
  // normalization done on open, like load).
  fitCanvasToWidth: (targetWidth: number) => void;

  // ── layout actions ──
  updateLayout: (name: string, patch: Partial<LayoutBox>) => void;
  moveSelectedTo: (primary: string, pos: ScreenPoint) => void;
  resizeField: (name: string, box: LayoutBox) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  bringToFront: () => void;
  sendToBack: () => void;

  // ── selection actions ──
  select: (name: string | null) => void;
  toggleSelect: (name: string) => void;
  selectMany: (names: string[], additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectInRect: (rect: Rect, additive: boolean) => void;

  // ── interaction + history ──
  beginInteraction: () => void;
  endInteraction: () => void;
  // Settle a sortable drag: snap the dragged field into its current slot.
  finishDrag: () => void;
  undo: () => void;
  redo: () => void;

  // ── viewport actions ──
  setViewportSize: (width: number, height: number) => void;

  // ── grid actions ──
  toggleSnap: () => void;
  setGridSize: (n: number) => void;
  // Toggle the column / row guideline overlays on the canvas.
  toggleColGuides: () => void;
  toggleRowGuides: () => void;

  // ── responsive actions ──
  setActiveBreakpoint: (bp: Breakpoint) => void;
  // Drop the active breakpoint's override for an item, so it inherits again.
  resetLayoutOverride: (name: string) => void;
};

// ── helpers ─────────────────────────────────────────────────────────────────

function firstPage(schema: FormSchema): FormPage {
  return schema.pages[0] ?? { name: "page1", elements: [] };
}

function allFields(schema: FormSchema): FormField[] {
  return schema.pages.flatMap((page) => page.elements);
}

// The form's configured element spacing, defaulting to FIELD_GAP on both axes.
function gapsOf(schema: FormSchema): { x: number; y: number } {
  return {
    x: schema.canvas?.gapX ?? FIELD_GAP,
    y: schema.canvas?.gapY ?? FIELD_GAP,
  };
}

// Seed a submit button below the content if the schema has none.
function ensureSubmit(schema: FormSchema): FormSchema {
  if (schema.submit?.layout) return schema;
  const fields = firstPage(schema).elements;
  return { ...schema, submit: { layout: defaultSubmitLayout(fields) } };
}

// Seed a title banner at the top of the canvas if the schema has none, so the
// form's title is always a movable element on the design surface. Existing
// content (fields + submit) is shifted down by the banner's height so the title
// gets its own row at the top instead of overlapping the first field.
function ensureTitle(schema: FormSchema): FormSchema {
  if (schema.titleBox?.layout) return schema;
  const width = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
  const box = defaultTitleLayout(width);
  const shift = box.height + FIELD_GAP;
  const shiftDown = (l: LayoutBox): LayoutBox => ({ ...l, y: l.y + shift });
  const page = firstPage(schema);
  return {
    ...schema,
    pages: [
      {
        ...page,
        elements: page.elements.map((e) =>
          e.layout ? { ...e, layout: shiftDown(e.layout) } : e,
        ),
      },
      ...schema.pages.slice(1),
    ],
    submit: schema.submit?.layout
      ? { ...schema.submit, layout: shiftDown(schema.submit.layout) }
      : schema.submit,
    titleBox: { layout: box },
  };
}

// Prepare a freshly opened schema: backfill ids + absolute layout so every field
// is a movable widget, guarantee canvas dimensions (defaulting to auto width so
// the form fits the canvas on open), and seed the submit button.
function normalize(schema: FormSchema): FormSchema {
  const withIds = ensureFieldIds(schema);
  const withLayout = ensureLayout(withIds);
  const canvas = withLayout.canvas ?? { width: DEFAULT_CANVAS_WIDTH, height: 720 };
  return ensureTitle(
    ensureSubmit({
      ...withLayout,
      canvas: {
        ...canvas,
        autoWidth: canvas.autoWidth ?? true,
        gapX: canvas.gapX ?? FIELD_GAP,
        gapY: canvas.gapY ?? FIELD_GAP,
        columns: clampColumns(canvas.columns),
      },
    }),
  );
}

export function createDesignerStore(initial: FormSchema): StoreApi<DesignerState> {
  return createStore<DesignerState>((set, get) => {
    // Replace page[0]'s elements via an updater, keeping the rest of the schema.
    const mapElements = (
      schema: FormSchema,
      updater: (elements: FormField[]) => FormField[],
    ): FormSchema => {
      const page = firstPage(schema);
      return {
        ...schema,
        pages: [
          { ...page, elements: updater(page.elements) },
          ...schema.pages.slice(1),
        ],
      };
    };

    // Layout of any selectable item (a field or the submit button) by name,
    // resolved for the breakpoint the canvas is currently designing.
    const itemLayout = (
      schema: FormSchema,
      name: string,
    ): LayoutBox | undefined => {
      const bp = get().activeBreakpoint;
      const item =
        name === SUBMIT_NAME
          ? schema.submit
          : name === TITLE_NAME
            ? schema.titleBox
            : firstPage(schema).elements.find((e) => e.name === name);
      return item ? resolveLayout(item, bp) : undefined;
    };

    // Replace one item's layout, writing to the active breakpoint (the base
    // layout, or a per-breakpoint override that drops itself when redundant).
    const setItemLayout = (
      schema: FormSchema,
      name: string,
      layout: LayoutBox,
    ): FormSchema => {
      const bp = get().activeBreakpoint;
      if (name === SUBMIT_NAME) {
        return schema.submit
          ? { ...schema, submit: setLayoutAt(schema.submit, bp, layout) }
          : schema;
      }
      if (name === TITLE_NAME) {
        return schema.titleBox
          ? { ...schema, titleBox: setLayoutAt(schema.titleBox, bp, layout) }
          : schema;
      }
      return mapElements(schema, (els) =>
        els.map((e) => (e.name === name ? setLayoutAt(e, bp, layout) : e)),
      );
    };

    // Apply a transform to the (resolved) layout of every named item, writing
    // the result to the active breakpoint.
    const mapItemLayouts = (
      schema: FormSchema,
      names: Set<string>,
      fn: (layout: LayoutBox) => LayoutBox,
    ): FormSchema => {
      const bp = get().activeBreakpoint;
      let next = mapElements(schema, (els) =>
        els.map((e) => {
          if (!names.has(e.name)) return e;
          const cur = resolveLayout(e, bp);
          return cur ? setLayoutAt(e, bp, fn(cur)) : e;
        }),
      );
      if (names.has(SUBMIT_NAME) && next.submit) {
        const cur = resolveLayout(next.submit, bp);
        if (cur) next = { ...next, submit: setLayoutAt(next.submit, bp, fn(cur)) };
      }
      if (names.has(TITLE_NAME) && next.titleBox) {
        const cur = resolveLayout(next.titleBox, bp);
        if (cur) next = { ...next, titleBox: setLayoutAt(next.titleBox, bp, fn(cur)) };
      }
      return next;
    };

    // Highest / lowest zIndex across all items (fields + submit), at the active
    // breakpoint.
    const zRange = (schema: FormSchema): { min: number; max: number } => {
      const bp = get().activeBreakpoint;
      const boxes = [
        ...firstPage(schema).elements.map((e) => resolveLayout(e, bp)),
        resolveLayout(schema.submit, bp),
        resolveLayout(schema.titleBox, bp),
      ];
      let min = Infinity;
      let max = 0;
      for (const b of boxes) {
        if (!b) continue;
        min = Math.min(min, b.zIndex);
        max = Math.max(max, b.zIndex);
      }
      return { min: min === Infinity ? 0 : min, max };
    };

    // Commit a new schema to history. `tag` coalesces consecutive same-tag edits
    // (e.g. typing in one property) into a single undo step. Discrete actions
    // pass no tag and never coalesce.
    const commit = (next: FormSchema, tag?: string) => {
      const { schema, selection, past, _coalesceTag } = get();
      if (next === schema) return;
      if (tag && tag === _coalesceTag) {
        set({ schema: next });
        return;
      }
      set({
        past: [...past, { schema, selection }],
        future: [],
        schema: next,
        _coalesceTag: tag ?? null,
      });
    };

    // Live document update during an interaction (drag/resize): no history push;
    // beginInteraction/endInteraction bracket the whole gesture into one step.
    const live = (next: FormSchema) => {
      if (next !== get().schema) set({ schema: next });
    };

    return {
      schema: normalize(initial),
      selection: [],
      viewport: { width: 0, height: 0 },
      snap: false,
      gridSize: GRID_SIZE,
      showColGuides: false,
      showRowGuides: false,
      activeBreakpoint: "base",
      past: [],
      future: [],
      _baseline: null,
      _coalesceTag: null,
      _dragName: null,
      _dragHome: null,

      // ── document ──
      load: (schema) =>
        set({
          schema: normalize(schema),
          selection: [],
          past: [],
          future: [],
          _baseline: null,
          _coalesceTag: null,
          activeBreakpoint: "base",
        }),

      addField: (type, defaultTitle, at) => {
        const def = getFieldType(type);
        if (!def) return;
        const { schema, snap } = get();
        const page = firstPage(schema);
        const elements = page.elements;
        const name = uniqueName(type, new Set(elements.map((e) => e.name)));
        const base: FormField = {
          type,
          id: newFieldId(),
          name,
          ...(def.group === "display" ? {} : { title: defaultTitle }),
          ...def.defaultProps(),
        };
        const canvasWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
        const height = defaultFieldHeight(base);
        const gapY = gapsOf(schema).y;

        // Dropping a (non-group) field onto a group section drops it INSIDE the
        // section: sized to fit the space it lands in (taking the free width of
        // the row it's dropped into so fields can sit side by side, else a
        // full-width row below the content), on top of the section, with the box
        // then grown to fit. Spatial containment makes it a member. The target is
        // whichever group's box the drop point lands in (topmost when they
        // overlap), so a field already sitting in the section doesn't block it.
        if (at && type !== "group") {
          let target: FormField | undefined;
          for (const e of elements) {
            if (e.type !== "group" || !e.layout) continue;
            const g = e.layout;
            const hit =
              at.x >= g.x && at.x <= g.x + g.width && at.y >= g.y && at.y <= g.y + g.height;
            if (hit && (!target || e.layout.zIndex > target.layout!.zIndex)) target = e;
          }
          if (target?.layout) {
            const g = target.layout;
            const { x: gapX, y: gapY2 } = gapsOf(schema);
            const members = fieldsInBox(elements, g, target.name).map((n) => ({
              layout: elements.find((x) => x.name === n)!.layout as LayoutBox,
            }));
            const box = groupInsertBox(
              members,
              g,
              at,
              gapX,
              gapY2,
              height,
              groupHeaderHeight(target),
            );
            const layout: LayoutBox = { ...box, zIndex: nextZIndex(elements) };
            // Append the field, then normalize the section: members are clamped
            // inside it and the box grows to fit its content.
            commit(
              mapElements(schema, (els) =>
                normalizeGroups([...els, { ...base, layout }], canvasWidth),
              ),
            );
            set({ selection: [name], _coalesceTag: null });
            return;
          }
        }

        // Where the new row goes:
        // • dropped on a field → directly below that field;
        // • dropped on bare canvas → at the drop point;
        // • added from the palette with no point → below all existing fields.
        let insertY: number;
        if (at) {
          const target = findItemAt(elements, at);
          insertY = target?.layout
            ? target.layout.y + target.layout.height + gapY
            : Math.max(PAGE_PADDING, snap ? snapValue(at.y) : Math.round(at.y));
        } else {
          const b = contentBounds(elements);
          insertY = b ? b.y + b.height + gapY : PAGE_PADDING;
        }

        // A group is a section container: it sits BEHIND the fields placed in it
        // (lowest stacking order) so those fields stay on top and clickable.
        const zIndex =
          type === "group"
            ? elements.reduce((m, e) => Math.min(m, e.layout?.zIndex ?? 0), 0) - 1
            : nextZIndex(elements);
        // New fields default to the full form width, expressed in columns (the
        // full span) — so out of the box a field is 100% wide, and the designer
        // narrows it by reducing its column span (per breakpoint, if they want).
        const layout: LayoutBox = {
          x: PAGE_PADDING,
          y: insertY,
          width: Math.round(canvasWidth - PAGE_PADDING * 2),
          height,
          zIndex,
          widthUnit: "col",
        };
        const field: FormField = { ...base, layout };

        // Reflow: push every item at or below the insertion line down by the new
        // row's height, so the dropped field never overlaps the ones under it.
        const shift = height + gapY;
        const pushDown = (l: LayoutBox): LayoutBox =>
          l.y >= insertY ? { ...l, y: l.y + shift } : l;
        const shifted = elements.map((e) =>
          e.layout ? { ...e, layout: pushDown(e.layout) } : e,
        );
        const submit = schema.submit?.layout
          ? { ...schema.submit, layout: pushDown(schema.submit.layout) }
          : schema.submit;

        commit({
          ...schema,
          pages: [
            { ...page, elements: [...shifted, field] },
            ...schema.pages.slice(1),
          ],
          submit,
        });
        set({ selection: [name], _coalesceTag: null });
      },

      removeField: (name) => {
        // The submit button can't be deleted.
        if (name === SUBMIT_NAME) return;
        const { schema, selection } = get();
        // Re-fit any section after removing a field, so it shrinks to its content.
        commit(
          mapElements(schema, (els) =>
            normalizeGroups(els.filter((e) => e.name !== name), schema.canvas?.width),
          ),
        );
        set({ selection: selection.filter((n) => n !== name) });
      },

      deleteSelected: () => {
        const { schema, selection } = get();
        // Never delete the submit button or the title, even within a multi-select.
        const drop = new Set(
          selection.filter((n) => n !== SUBMIT_NAME && n !== TITLE_NAME),
        );
        if (drop.size === 0) return;
        commit(
          mapElements(schema, (els) =>
            normalizeGroups(els.filter((e) => !drop.has(e.name)), schema.canvas?.width),
          ),
        );
        set({ selection: [], _coalesceTag: null });
      },

      duplicateSelected: () => {
        const { schema, selection, gridSize } = get();
        if (selection.length === 0) return;
        const elements = firstPage(schema).elements;
        const taken = new Set(elements.map((e) => e.name));
        const dup = new Set(selection);
        const copies: FormField[] = [];
        const newNames: string[] = [];
        let z = nextZIndex(elements);
        for (const el of elements) {
          if (!dup.has(el.name)) continue;
          const name = uniqueName(`${el.name}_copy`, taken);
          taken.add(name);
          newNames.push(name);
          copies.push({
            ...el,
            id: newFieldId(),
            name,
            layout: el.layout
              ? {
                  ...el.layout,
                  x: el.layout.x + gridSize,
                  y: el.layout.y + gridSize,
                  zIndex: (z += 1),
                }
              : el.layout,
          });
        }
        commit(mapElements(schema, (els) => [...els, ...copies]));
        set({ selection: newNames, _coalesceTag: null });
      },

      moveField: (from, to) => {
        const { schema } = get();
        commit(
          mapElements(schema, (els) => {
            if (
              from === to ||
              from < 0 ||
              to < 0 ||
              from >= els.length ||
              to >= els.length
            ) {
              return els;
            }
            const next = [...els];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          }),
        );
      },

      updateField: (name, patch) => {
        const { schema } = get();
        commit(
          mapElements(schema, (els) =>
            els.map((e) => (e.name === name ? { ...e, ...patch } : e)),
          ),
          `prop:${name}:${Object.keys(patch).sort().join(",")}`,
        );
      },

      renameField: (name, nextName) => {
        const trimmed = nextName.trim();
        if (!trimmed || trimmed === name) return trimmed === name;
        const { schema, selection } = get();
        if (allFields(schema).some((e) => e.name === trimmed)) return false;
        commit(
          mapElements(schema, (els) =>
            els.map((e) => (e.name === name ? { ...e, name: trimmed } : e)),
          ),
        );
        set({
          selection: selection.map((n) => (n === name ? trimmed : n)),
          _coalesceTag: null,
        });
        return true;
      },

      updateForm: (patch) => commit({ ...get().schema, ...patch }, "form"),

      updateTitleStyle: (patch) => {
        const { schema } = get();
        const width = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
        const cur = schema.titleBox ?? { layout: defaultTitleLayout(width) };
        commit({ ...schema, titleBox: { ...cur, ...patch } }, "titleStyle");
      },

      setTheme: (theme) => commit({ ...get().schema, theme }, "theme"),

      setCanvasSize: (size) => {
        const { schema } = get();
        const cur = gapsOf(schema);
        const canvas: CanvasSettings = {
          width: size.width ?? schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH,
          height: size.height ?? schema.canvas?.height ?? 720,
          // Pinning a width explicitly turns auto off.
          autoWidth:
            size.autoWidth ??
            (size.width != null ? false : schema.canvas?.autoWidth ?? true),
          gapX: cur.x,
          gapY: cur.y,
          columns: clampColumns(schema.canvas?.columns),
          maxWidth: schema.canvas?.maxWidth,
        };
        commit({ ...schema, canvas }, "canvas");
      },

      setGap: (gap) => {
        const { schema } = get();
        const cur = gapsOf(schema);
        const canvas: CanvasSettings = {
          width: schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH,
          height: schema.canvas?.height ?? 720,
          autoWidth: schema.canvas?.autoWidth ?? true,
          gapX: Math.max(0, Math.round(gap.x ?? cur.x)),
          gapY: Math.max(0, Math.round(gap.y ?? cur.y)),
          columns: clampColumns(schema.canvas?.columns),
          maxWidth: schema.canvas?.maxWidth,
        };
        commit({ ...schema, canvas }, "gap");
      },

      setColumns: (columns) => {
        const { schema } = get();
        const cur = gapsOf(schema);
        const canvas: CanvasSettings = {
          width: schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH,
          height: schema.canvas?.height ?? 720,
          autoWidth: schema.canvas?.autoWidth ?? true,
          gapX: cur.x,
          gapY: cur.y,
          columns: clampColumns(columns),
          maxWidth: schema.canvas?.maxWidth,
        };
        commit({ ...schema, canvas }, "columns");
      },

      setMaxWidth: (maxWidth) => {
        const { schema } = get();
        const cur = gapsOf(schema);
        const mw =
          maxWidth == null || !Number.isFinite(maxWidth) || maxWidth <= 0
            ? undefined
            : Math.round(maxWidth);
        const canvas: CanvasSettings = {
          width: schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH,
          height: schema.canvas?.height ?? 720,
          autoWidth: schema.canvas?.autoWidth ?? true,
          gapX: cur.x,
          gapY: cur.y,
          columns: clampColumns(schema.canvas?.columns),
          maxWidth: mw,
        };
        commit({ ...schema, canvas }, "maxWidth");
      },

      fitCanvasToWidth: (targetWidth) => {
        const { schema } = get();
        const oldW = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
        const newW = Math.round(targetWidth);
        if (newW <= 0 || Math.abs(newW - oldW) < 1) return;
        const scale = newW / oldW;
        const scaleX = (l: LayoutBox): LayoutBox => ({
          ...l,
          x: Math.round(l.x * scale),
          width: Math.max(MIN_WIDTH, Math.round(l.width * scale)),
        });
        const page = firstPage(schema);
        const elements = page.elements.map((e) =>
          e.layout ? { ...e, layout: scaleX(e.layout) } : e,
        );
        set({
          schema: {
            ...schema,
            pages: [{ ...page, elements }, ...schema.pages.slice(1)],
            submit: schema.submit?.layout
              ? { ...schema.submit, layout: scaleX(schema.submit.layout) }
              : schema.submit,
            titleBox: schema.titleBox?.layout
              ? { ...schema.titleBox, layout: scaleX(schema.titleBox.layout) }
              : schema.titleBox,
            canvas: {
              width: newW,
              height: schema.canvas?.height ?? 720,
              autoWidth: schema.canvas?.autoWidth ?? true,
              gapX: schema.canvas?.gapX ?? FIELD_GAP,
              gapY: schema.canvas?.gapY ?? FIELD_GAP,
              columns: clampColumns(schema.canvas?.columns),
              maxWidth: schema.canvas?.maxWidth,
            },
          },
        });
      },

      // ── layout ──
      updateLayout: (name, patch) => {
        const { schema } = get();
        const cur = itemLayout(schema, name);
        if (!cur) return;
        commit(
          setItemLayout(schema, name, clampBox({ ...cur, ...patch })),
          `layout:${name}`,
        );
      },

      moveSelectedTo: (primary, pos) => {
        const { schema, selection, _baseline, activeBreakpoint } = get();
        const baseSchema = _baseline?.schema ?? schema;
        const baseEls = firstPage(baseSchema).elements;
        const selected = selection.includes(primary) ? selection : [primary];

        // Designing a specific breakpoint: a plain free move. Shift the selection
        // (and any group's contained fields, by base-layout membership) by the
        // cursor delta and write the result to this breakpoint's override. The
        // smart row-flow / overlap reflow stays a base-design behaviour.
        if (activeBreakpoint !== "base") {
          const moving = new Set(selected);
          for (const nm of selected) {
            const g = baseEls.find((e) => e.name === nm);
            if (g?.type === "group" && g.layout) {
              for (const m of fieldsInBox(baseEls, g.layout, nm)) moving.add(m);
            }
          }
          const lead = itemLayout(schema, primary);
          if (!lead) return;
          const dx = pos.x - lead.x;
          const dy = pos.y - lead.y;
          if (dx === 0 && dy === 0) return;
          live(
            mapItemLayouts(schema, moving, (l) => ({
              ...l,
              x: Math.max(0, Math.round(l.x + dx)),
              y: Math.max(0, Math.round(l.y + dy)),
            })),
          );
          return;
        }

        // Expand any group in the moving set to also carry the fields inside it,
        // so dragging a section box moves its contents with it. Membership is read
        // from the gesture's baseline so it stays fixed for the whole drag.
        const movingSet = new Set(selected);
        for (const nm of selected) {
          const g = baseEls.find((e) => e.name === nm);
          if (g?.type === "group" && g.layout) {
            for (const m of fieldsInBox(baseEls, g.layout, nm)) movingSet.add(m);
          }
        }
        const moving = [...movingSet];
        const primaryIsGroup =
          baseEls.find((e) => e.name === primary)?.type === "group";

        // Multi-selection, a section box (now carrying its members), the submit
        // button, or the title: free delta move (no swap / row-flow semantics).
        if (
          moving.length > 1 ||
          primary === SUBMIT_NAME ||
          primary === TITLE_NAME ||
          primaryIsGroup
        ) {
          const lead = itemLayout(schema, primary);
          if (!lead) return;
          const dx = pos.x - lead.x;
          const dy = pos.y - lead.y;
          if (dx === 0 && dy === 0) return;
          live(
            mapItemLayouts(schema, new Set(moving), (l) => ({
              ...l,
              x: Math.max(0, Math.round(l.x + dx)),
              y: Math.max(0, Math.round(l.y + dy)),
            })),
          );
          return;
        }

        // Single field: free move within the form, with no overlap. The dragged
        // field follows the cursor and rests wherever it's dropped — so you can
        // move it freely within its row (e.g. nudge it left/right, or drop it in
        // the empty space beside another field). It's only when the field would
        // OVERLAP another that the fields re-flow into rows (packRows) so they
        // sit side by side / wrap instead of overlapping. Every field keeps its
        // own size; on drop the dragged field settles into its resting box.
        const cur = get();
        const base = cur._baseline?.schema ?? schema;
        const aBase = firstPage(base).elements.find((e) => e.name === primary);
        if (!aBase?.layout) return;
        const aLayout = aBase.layout;
        const { x: gapX, y: gapY } = gapsOf(schema);
        const canvasWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
        const left = PAGE_PADDING;
        const right = canvasWidth - PAGE_PADDING;

        // The other fields (gesture-start positions), in reading order. Group
        // containers are excluded so dragging a field never re-flows a section.
        const baseElements = firstPage(base).elements;
        const others = baseElements
          .filter((e) => e.name !== primary && e.layout && e.type !== "group")
          .map((e) => ({ name: e.name, layout: e.layout as LayoutBox }))
          .sort((p, q) => p.layout.y - q.layout.y || p.layout.x - q.layout.x);

        // The dragged box at the cursor, kept inside the page's content area so a
        // field can't be lost off an edge.
        const maxX = Math.max(left, right - aLayout.width);
        const movedA: LayoutBox = {
          ...aLayout,
          x: Math.min(maxX, Math.max(left, Math.round(pos.x))),
          y: Math.max(PAGE_PADDING, Math.round(pos.y)),
        };

        const page = firstPage(schema);

        // Free placement: as long as the dragged field doesn't overlap any other,
        // it simply rests where dropped and the others stay put.
        if (!others.some((o) => rectsIntersect(movedA, o.layout))) {
          const baseByName = new Map(baseElements.map((e) => [e.name, e.layout]));
          const elements = page.elements.map((e) => {
            if (e.name === primary) return { ...e, layout: movedA };
            const homeBox = baseByName.get(e.name);
            return homeBox ? { ...e, layout: homeBox } : e;
          });
          set({
            schema: {
              ...schema,
              pages: [{ ...page, elements }, ...schema.pages.slice(1)],
            },
            _dragName: primary,
            _dragHome: movedA,
          });
          return;
        }

        // Overlap → re-flow into rows so nothing overlaps. The cursor's 2-D
        // position picks the dragged field's place in the flow.
        const top = others.reduce((m, o) => Math.min(m, o.layout.y), aLayout.y);
        const cx = movedA.x + movedA.width / 2;
        const cy = movedA.y + movedA.height / 2;
        const solo = packRows(others, left, right, top, gapX, gapY);
        let idx = 0;
        for (const o of others) {
          const p = solo.get(o.name)!;
          const slotCx = p.x + o.layout.width / 2;
          const before =
            cy < p.y ? false : cy > p.y + o.layout.height ? true : slotCx < cx;
          if (before) idx += 1;
        }
        const order = [
          ...others.slice(0, idx),
          { name: primary, layout: aLayout },
          ...others.slice(idx),
        ];
        const packed = packRows(order, left, right, top, gapX, gapY);
        const slot = packed.get(primary);
        const home: LayoutBox = slot ? { ...aLayout, ...slot } : movedA;

        const elements = page.elements.map((e) => {
          if (e.name === primary) return { ...e, layout: movedA };
          const p = packed.get(e.name);
          return e.layout && p ? { ...e, layout: { ...e.layout, ...p } } : e;
        });
        set({
          schema: {
            ...schema,
            pages: [{ ...page, elements }, ...schema.pages.slice(1)],
          },
          _dragName: primary,
          _dragHome: home,
        });
      },

      resizeField: (name, box) => {
        const { schema, snap, gridSize, _baseline, activeBreakpoint } = get();
        const next = snap ? snapBox(clampBox(box), gridSize) : clampBox(box);

        // The title banner resizes freely without reflowing its neighbours (it
        // sits above the content, like a section box overlaps its own).
        if (name === TITLE_NAME) {
          live(setItemLayout(schema, name, next));
          return;
        }

        // Designing a specific breakpoint: just set this item's size for that
        // breakpoint (an override), with no neighbour/section reflow.
        if (activeBreakpoint !== "base") {
          live(setItemLayout(schema, name, next));
          return;
        }

        // Resizing a section box only changes the box: it overlaps its own
        // contents by design, so the neighbour-reflow below must not run (it would
        // shove the contained fields out). Clamp its members to the new bounds so
        // shrinking the section keeps fields inside it (its height stays as set —
        // it auto-fits when members are added/removed/moved).
        if (firstPage(schema).elements.find((e) => e.name === name)?.type === "group") {
          live(
            mapElements(setItemLayout(schema, name, next), (els) =>
              clampMembersToGroups(els),
            ),
          );
          return;
        }

        // Reflow the neighbours of the resized field from where they sat when
        // this gesture began: growing it downward shoves the fields below down,
        // growing it upward shoves the fields above up, so it never overlaps them
        // (and the page, which sizes to its content, grows to fit). Shrinking it
        // lets them return. Outside an interaction, reflow from the current
        // layout. Build the item list with the resized field at its new box.
        const base = _baseline?.schema ?? schema;
        const baseFields = firstPage(base).elements;
        const items: { name: string; layout: LayoutBox }[] = [];
        for (const e of baseFields) {
          if (e.layout) {
            items.push({ name: e.name, layout: e.name === name ? next : e.layout });
          }
        }
        if (base.submit?.layout) {
          items.push({
            name: SUBMIT_NAME,
            layout: name === SUBMIT_NAME ? next : base.submit.layout,
          });
        }
        // Push neighbours away on whichever side the field grew, keeping the
        // form's configured gaps. Partition the others by their relationship to
        // the field's ORIGINAL footprint: those sharing its column (horizontal
        // overlap) reflow vertically; those sharing its row (vertical overlap)
        // reflow horizontally. Without this split a downward growth — which makes
        // the field below overlap vertically while still sharing the same x —
        // would also be read as a rightward collision and shove it sideways.
        const { x: gapX, y: gapY } = gapsOf(schema);
        const a0 =
          (name === SUBMIT_NAME
            ? base.submit?.layout
            : baseFields.find((e) => e.name === name)?.layout) ?? next;
        const anchorItem = items.find((it) => it.name === name)!;
        // Section boxes never get pushed by a field resize (they overlap their
        // own contents on purpose), so keep them out of the reflow candidates.
        const groupNames = new Set(
          baseFields.filter((e) => e.type === "group").map((e) => e.name),
        );
        const xShare = (b: LayoutBox) => b.x < a0.x + a0.width && b.x + b.width > a0.x;
        const yShare = (b: LayoutBox) => b.y < a0.y + a0.height && b.y + b.height > a0.y;
        const colItems = [
          anchorItem,
          ...items.filter(
            (it) => it.name !== name && !groupNames.has(it.name) && xShare(it.layout),
          ),
        ];
        const rowItems = [
          anchorItem,
          ...items.filter(
            (it) => it.name !== name && !groupNames.has(it.name) && yShare(it.layout),
          ),
        ];
        const moved = new Map([
          ...reflowAbove(colItems, name, gapY),
          ...reflowBelow(colItems, name, gapY),
          ...reflowLeft(rowItems, name, gapX),
          ...reflowRight(rowItems, name, gapX),
        ]);

        // Apply: resized field → its new box; shifted items → their pushed box;
        // everything else → its gesture-start position (so a prior frame's push
        // is undone when the field shrinks back).
        const page = firstPage(schema);
        const baseByName = new Map(baseFields.map((e) => [e.name, e.layout]));
        const elements = page.elements.map((e) => {
          if (!e.layout) return e;
          if (e.name === name) return { ...e, layout: next };
          const pushed = moved.get(e.name);
          if (pushed) return { ...e, layout: pushed };
          const home = baseByName.get(e.name);
          return home ? { ...e, layout: home } : e;
        });
        let submit = schema.submit;
        if (schema.submit) {
          const layout =
            name === SUBMIT_NAME
              ? next
              : moved.get(SUBMIT_NAME) ?? base.submit?.layout ?? schema.submit.layout;
          submit = { ...schema.submit, layout };
        }

        // Normalize sections so a member being resized is capped to its section
        // (max width = section − padding, never over the title) and the section
        // height tracks its content.
        live({
          ...schema,
          pages: [
            { ...page, elements: normalizeGroups(elements, schema.canvas?.width) },
            ...schema.pages.slice(1),
          ],
          submit,
        });
      },

      nudgeSelected: (dx, dy) => {
        const { schema, selection } = get();
        if (selection.length === 0) return;
        commit(
          mapItemLayouts(schema, new Set(selection), (l) => ({
            ...l,
            x: Math.max(0, l.x + dx),
            y: Math.max(0, l.y + dy),
          })),
          "nudge",
        );
      },

      bringToFront: () => {
        const { schema, selection } = get();
        if (selection.length === 0) return;
        let z = zRange(schema).max;
        commit(
          mapItemLayouts(schema, new Set(selection), (l) => ({
            ...l,
            zIndex: (z += 1),
          })),
        );
      },

      sendToBack: () => {
        const { schema, selection } = get();
        if (selection.length === 0) return;
        let z = zRange(schema).min;
        commit(
          mapItemLayouts(schema, new Set(selection), (l) => ({
            ...l,
            zIndex: (z -= 1),
          })),
        );
      },

      // ── selection ──
      select: (name) =>
        set({ selection: name ? [name] : [], _coalesceTag: null }),

      toggleSelect: (name) => {
        const { selection } = get();
        set({
          selection: selection.includes(name)
            ? selection.filter((n) => n !== name)
            : [...selection, name],
          _coalesceTag: null,
        });
      },

      selectMany: (names, additive) => {
        const { selection } = get();
        const next = additive
          ? Array.from(new Set([...selection, ...names]))
          : names;
        set({ selection: next, _coalesceTag: null });
      },

      selectAll: () =>
        set({
          selection: [
            ...allFields(get().schema).map((e) => e.name),
            SUBMIT_NAME,
            TITLE_NAME,
          ],
          _coalesceTag: null,
        }),

      clearSelection: () => set({ selection: [], _coalesceTag: null }),

      selectInRect: (rect, additive) => {
        const schema = get().schema;
        const hits = firstPage(schema)
          .elements.filter((e) => e.layout && rectsIntersect(rect, e.layout))
          .map((e) => e.name);
        if (schema.submit?.layout && rectsIntersect(rect, schema.submit.layout)) {
          hits.push(SUBMIT_NAME);
        }
        if (schema.titleBox?.layout && rectsIntersect(rect, schema.titleBox.layout)) {
          hits.push(TITLE_NAME);
        }
        get().selectMany(hits, additive);
      },

      // ── interaction + history ──
      beginInteraction: () => {
        const { schema, selection } = get();
        set({
          _baseline: { schema, selection },
          _coalesceTag: null,
          _dragName: null,
          _dragHome: null,
        });
      },

      // Snap the dragged field into its current slot (set during the sortable
      // drag), so it never rests overlapping another. No-op for resize / free
      // drags. Runs before endInteraction, which commits the whole gesture.
      finishDrag: () => {
        const { _dragName, _dragHome, schema } = get();
        if (!_dragName || !_dragHome) {
          if (_dragName || _dragHome) set({ _dragName: null, _dragHome: null });
          return;
        }
        const home = _dragHome;
        set({
          // Settle the dragged field, then normalize sections: a field dragged
          // into one is clamped inside it (below the title, within its width) and
          // the section grows/shrinks to fit.
          schema: mapElements(schema, (els) =>
            normalizeGroups(
              els.map((e) => (e.name === _dragName ? { ...e, layout: home } : e)),
              schema.canvas?.width,
            ),
          ),
          _dragName: null,
          _dragHome: null,
        });
      },

      endInteraction: () => {
        const { _baseline, schema, past } = get();
        if (_baseline && _baseline.schema !== schema) {
          set({
            past: [...past, _baseline],
            future: [],
            _baseline: null,
            _coalesceTag: null,
          });
        } else {
          set({ _baseline: null });
        }
      },

      undo: () => {
        const { past, future, schema, selection } = get();
        const prev = past[past.length - 1];
        if (!prev) return;
        set({
          past: past.slice(0, -1),
          future: [{ schema, selection }, ...future],
          schema: prev.schema,
          selection: prev.selection,
          _coalesceTag: null,
          _baseline: null,
        });
      },

      redo: () => {
        const { past, future, schema, selection } = get();
        const next = future[0];
        if (!next) return;
        set({
          past: [...past, { schema, selection }],
          future: future.slice(1),
          schema: next.schema,
          selection: next.selection,
          _coalesceTag: null,
          _baseline: null,
        });
      },

      // ── viewport ──
      setViewportSize: (width, height) =>
        set({ viewport: { width, height } }),

      // ── grid ──
      toggleSnap: () => set({ snap: !get().snap }),
      setGridSize: (n) => set({ gridSize: Math.max(4, Math.round(n)) }),
      toggleColGuides: () => set({ showColGuides: !get().showColGuides }),
      toggleRowGuides: () => set({ showRowGuides: !get().showRowGuides }),

      // ── responsive ──
      setActiveBreakpoint: (bp) =>
        set({ activeBreakpoint: bp, _coalesceTag: null }),

      resetLayoutOverride: (name) => {
        const { schema, activeBreakpoint: bp } = get();
        if (bp === "base") return; // base is the default; nothing to reset
        if (name === SUBMIT_NAME) {
          if (schema.submit) {
            commit({ ...schema, submit: clearLayoutAt(schema.submit, bp) });
          }
          return;
        }
        commit(
          mapElements(schema, (els) =>
            els.map((e) => (e.name === name ? clearLayoutAt(e, bp) : e)),
          ),
        );
      },
    };
  });
}

// ── React wiring ─────────────────────────────────────────────────────────────

export type DesignerStoreApi = StoreApi<DesignerState>;

const DesignerStoreContext = createContext<DesignerStoreApi | null>(null);

export const DesignerStoreProvider = DesignerStoreContext.Provider;

export function useDesignerStoreApi(): DesignerStoreApi {
  const store = useContext(DesignerStoreContext);
  if (!store) {
    throw new Error("useDesigner* must be used within a DesignerStoreProvider");
  }
  return store;
}

// Subscribe to a slice of the designer store.
export function useDesigner<T>(selector: (state: DesignerState) => T): T {
  return useStore(useDesignerStoreApi(), selector);
}
