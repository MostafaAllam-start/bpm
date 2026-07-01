import { rectsIntersect } from "../canvasLayout";
import { allFields, firstPage } from "./schemaUtils";
import { SUBMIT_NAME, TITLE_NAME, type DesignerState, type GetFn, type SetFn } from "./types";

type SelectionActions = Pick<
  DesignerState,
  "select" | "toggleSelect" | "selectMany" | "selectAll" | "clearSelection" | "selectInRect"
>;

export function createSelectionSlice(set: SetFn, get: GetFn): SelectionActions {
  return {
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
  };
}
