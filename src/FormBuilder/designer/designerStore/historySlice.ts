import { normalizeGroups } from "../canvasLayout";
import { mapElements } from "./schemaUtils";
import { type DesignerState, type GetFn, type SetFn } from "./types";

type HistoryActions = Pick<
  DesignerState,
  "beginInteraction" | "endInteraction" | "finishDrag" | "undo" | "redo"
>;

export function createHistorySlice(set: SetFn, get: GetFn): HistoryActions {
  return {
    beginInteraction: () => {
      const { schema, selection } = get();
      set({
        _baseline: { schema, selection },
        _coalesceTag: null,
        _dragName: null,
        _dragHome: null,
      });
    },

    // Settle the dragged field into its current slot before endInteraction commits.
    finishDrag: () => {
      const { _dragName, _dragHome, schema } = get();
      if (!_dragName || !_dragHome) {
        if (_dragName || _dragHome) set({ _dragName: null, _dragHome: null });
        return;
      }
      const home = _dragHome;
      set({
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
  };
}
