// Wires interact.js drag + resize onto a LayoutContainer element. All geometry
// is computed in canvas space: pointer deltas come back in client pixels, so we
// divide by the current zoom before applying them. Snapping and min-size live in
// the store (moveSelectedTo / resizeField); this hook only translates pointer
// gestures into store calls and brackets each gesture with begin/endInteraction
// so the whole drag or resize is a single undo step.

import { useEffect, type RefObject } from "react";
import interact from "interactjs";

import type { LayoutBox } from "../types";
import { resolveLayout } from "../responsive";
import { snapValue } from "./canvasLayout";
import {
  SUBMIT_NAME,
  TITLE_NAME,
  useDesignerStoreApi,
  type DesignerState,
} from "./designerStore";

// Flip to true to trace the full interaction chain (drag/resize start·move·end)
// in the console — useful for verifying that interact.js actually receives the
// document-level pointer events and that store updates follow.
const DEBUG_INTERACTIONS = false;
function trace(...args: unknown[]): void {
  if (DEBUG_INTERACTIONS) console.log("[interact]", ...args);
}

function layoutOf(state: DesignerState, name: string): LayoutBox | undefined {
  const item =
    name === SUBMIT_NAME
      ? state.schema.submit
      : name === TITLE_NAME
        ? state.schema.titleBox
        : state.schema.pages[0]?.elements.find((e) => e.name === name);
  return item ? resolveLayout(item, state.activeBreakpoint) : undefined;
}

// Selectors for sub-elements that should never start a drag/resize (the delete
// button and any nested form control in the preview).
const IGNORE = ".dz-lc-nodrag, input, textarea, select, button, a";

export function useInteractable(
  ref: RefObject<HTMLDivElement | null>,
  name: string,
): void {
  const store = useDesignerStoreApi();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Raw (pre-snap) primary position accumulated across a drag, so snapping
    // never loses sub-grid pointer movement.
    let rawX = 0;
    let rawY = 0;
    // Running (pre-clamp) box accumulated across a resize.
    let running: LayoutBox | null = null;

    const interactable = interact(el)
      .draggable({
        ignoreFrom: IGNORE,
        listeners: {
          start() {
            const st = store.getState();
            const layout = layoutOf(st, name);
            if (!layout) return;
            rawX = layout.x;
            rawY = layout.y;
            st.beginInteraction();
            trace("drag:start", name, { x: rawX, y: rawY });
          },
          move(event) {
            const st = store.getState();
            const z = st.zoom || 1;
            rawX += event.dx / z;
            rawY += event.dy / z;
            const pos = st.snap
              ? { x: snapValue(rawX, st.gridSize), y: snapValue(rawY, st.gridSize) }
              : { x: rawX, y: rawY };
            st.moveSelectedTo(name, pos);
            trace("drag:move", name, pos);
          },
          end() {
            const st = store.getState();
            // Optional-chain so a hot-reloaded hook calling into a store
            // instance that predates finishDrag (Fast Refresh preserves the
            // store created in useState) degrades gracefully instead of
            // throwing mid-drag; a full reload restores the snap-to-slot step.
            st.finishDrag?.();
            st.endInteraction();
            trace("drag:end", name);
          },
        },
      })
      .resizable({
        edges: { top: true, right: true, bottom: true, left: true },
        margin: 8,
        ignoreFrom: IGNORE,
        listeners: {
          start() {
            const st = store.getState();
            const layout = layoutOf(st, name);
            if (!layout) return;
            running = { ...layout };
            st.beginInteraction();
            trace("resize:start", name, running);
          },
          move(event) {
            if (!running) return;
            const st = store.getState();
            const z = st.zoom || 1;
            const d = event.deltaRect;
            running = {
              ...running,
              x: running.x + (d?.left ?? 0) / z,
              y: running.y + (d?.top ?? 0) / z,
              width: running.width + (d?.width ?? 0) / z,
              height: running.height + (d?.height ?? 0) / z,
            };
            st.resizeField(name, running);
            trace("resize:move", name, running);
          },
          end() {
            running = null;
            store.getState().endInteraction();
            trace("resize:end", name);
          },
        },
      });

    return () => {
      interactable.unset();
    };
  }, [ref, name, store]);
}
