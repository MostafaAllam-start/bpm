import type { CanvasSettings, FormField, LayoutBox } from "../../types";
import {
  clampColumns,
  contentBounds,
  DEFAULT_CANVAS_WIDTH,
  defaultFieldHeight,
  defaultTitleLayout,
  FIELD_GAP,
  fieldsInBox,
  findItemAt,
  groupHeaderHeight,
  groupInsertBox,
  MIN_WIDTH,
  nextZIndex,
  normalizeGroups,
  PAGE_PADDING,
  snapValue,
} from "../canvasLayout";
import { getFieldType } from "../../utils/fieldTypes";
import { newFieldId, uniqueName } from "../ids";
import { allFields, firstPage, gapsOf, mapElements, normalize } from "./schemaUtils";
import { SUBMIT_NAME, TITLE_NAME, type DesignerState, type GetFn, type SetFn } from "./types";
import type { StoreHelpers } from "./storeHelpers";

type DocumentActions = Pick<
  DesignerState,
  | "load"
  | "addField"
  | "removeField"
  | "deleteSelected"
  | "duplicateSelected"
  | "moveField"
  | "updateField"
  | "renameField"
  | "updateForm"
  | "updateTitleStyle"
  | "setTheme"
  | "setCanvasSize"
  | "setGap"
  | "setColumns"
  | "setMaxWidth"
  | "fitCanvasToWidth"
>;

export function createDocumentSlice(
  set: SetFn,
  get: GetFn,
  { commit }: Pick<StoreHelpers, "commit">,
): DocumentActions {
  return {
    load: (schema) => {
      const { viewport } = get();
      const normalized = normalize(schema);
      set({
        schema: normalized,
        selection: [],
        past: [],
        future: [],
        _baseline: null,
        _coalesceTag: null,
        activeBreakpoint: "base",
      });
      // The canvas's useLayoutEffect only re-runs on breakpoint changes, not on
      // schema load, so `fitCanvasToWidth` never fires after picking a template.
      // Re-fit here immediately using the already-known viewport width.
      if (normalized.canvas?.autoWidth !== false && viewport.width > 0) {
        get().fitCanvasToWidth(Math.max(360, viewport.width));
      }
    },

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
      // section: sized to fit the space it lands in, on top of the section.
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

      // Groups sit BEHIND fields (lowest stacking) so contained fields stay clickable.
      const zIndex =
        type === "group"
          ? elements.reduce((m, e) => Math.min(m, e.layout?.zIndex ?? 0), 0) - 1
          : nextZIndex(elements);
      const layout: LayoutBox = {
        x: PAGE_PADDING,
        y: insertY,
        width: Math.round(canvasWidth - PAGE_PADDING * 2),
        height,
        zIndex,
        widthUnit: "col",
      };
      const field: FormField = { ...base, layout };

      // Reflow: push every item at or below the insertion line down by the new row's height.
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
      if (name === SUBMIT_NAME) return;
      const { schema, selection } = get();
      commit(
        mapElements(schema, (els) =>
          normalizeGroups(els.filter((e) => e.name !== name), schema.canvas?.width),
        ),
      );
      set({ selection: selection.filter((n) => n !== name) });
    },

    deleteSelected: () => {
      const { schema, selection } = get();
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
  };
}
