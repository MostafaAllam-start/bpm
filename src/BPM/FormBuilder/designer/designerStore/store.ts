import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { FormSchema } from "../../types";
import { GRID_SIZE } from "../canvasLayout";
import { normalize } from "./schemaUtils";
import { makeStoreHelpers } from "./storeHelpers";
import { createDocumentSlice } from "./documentSlice";
import { createLayoutSlice } from "./layoutSlice";
import { createSelectionSlice } from "./selectionSlice";
import { createHistorySlice } from "./historySlice";
import { createViewportSlice } from "./viewportSlice";
import type { DesignerState } from "./types";

export type DesignerStoreApi = StoreApi<DesignerState>;

export function createDesignerStore(initial: FormSchema): DesignerStoreApi {
  return createStore<DesignerState>((set, get) => {
    const helpers = makeStoreHelpers(set, get);
    return {
      // ── initial state ──
      schema: normalize(initial),
      selection: [],
      viewport: { width: 0, height: 0 },
      snap: false,
      gridSize: GRID_SIZE,
      showColGuides: false,
      showRowGuides: false,
      activeBreakpoint: "base",
      activePageIndex: 0,
      past: [],
      future: [],
      _baseline: null,
      _coalesceTag: null,
      _dragName: null,
      _dragHome: null,
      // ── slices ──
      ...createDocumentSlice(set, get, helpers),
      ...createLayoutSlice(set, get, helpers),
      ...createSelectionSlice(set, get),
      ...createHistorySlice(set, get),
      ...createViewportSlice(set, get, helpers),
    };
  });
}

// ── React wiring ─────────────────────────────────────────────────────────────

const DesignerStoreContext = createContext<DesignerStoreApi | null>(null);

export const DesignerStoreProvider = DesignerStoreContext.Provider;

export function useDesignerStoreApi(): DesignerStoreApi {
  const store = useContext(DesignerStoreContext);
  if (!store) {
    throw new Error("useDesigner* must be used within a DesignerStoreProvider");
  }
  return store;
}

export function useDesigner<T>(selector: (state: DesignerState) => T): T {
  return useStore(useDesignerStoreApi(), selector);
}
