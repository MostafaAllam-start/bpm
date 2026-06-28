import { clearLayoutAt } from "../../utils/responsive";
import { mapElements } from "./schemaUtils";
import { SUBMIT_NAME, type DesignerState, type GetFn, type SetFn } from "./types";
import type { StoreHelpers } from "./storeHelpers";

type ViewportActions = Pick<
  DesignerState,
  | "setViewportSize"
  | "toggleSnap"
  | "setGridSize"
  | "toggleColGuides"
  | "toggleRowGuides"
  | "setActiveBreakpoint"
  | "resetLayoutOverride"
>;

export function createViewportSlice(
  set: SetFn,
  get: GetFn,
  { commit }: Pick<StoreHelpers, "commit">,
): ViewportActions {
  return {
    setViewportSize: (width, height) => set({ viewport: { width, height } }),

    toggleSnap: () => set({ snap: !get().snap }),

    setGridSize: (n) => set({ gridSize: Math.max(4, Math.round(n)) }),

    toggleColGuides: () => set({ showColGuides: !get().showColGuides }),

    toggleRowGuides: () => set({ showRowGuides: !get().showRowGuides }),

    setActiveBreakpoint: (bp) => set({ activeBreakpoint: bp, _coalesceTag: null }),

    resetLayoutOverride: (name) => {
      const { schema, activeBreakpoint: bp } = get();
      if (bp === "base") return;
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
}
