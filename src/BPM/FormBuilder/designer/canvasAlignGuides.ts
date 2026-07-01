import type { FormField } from "../types";
import type { AlignGuide } from "./designerStore/types";
import { resolveLayout } from "../utils/responsive";
import type { Breakpoint } from "../types";

const SNAP_THRESHOLD = 6; // px — snap to guide if dragged item edge is within this

export function computeAlignGuides(
  dragging: string[],
  elements: FormField[],
  canvasWidth: number,
  activeBreakpoint: Breakpoint,
): AlignGuide[] {
  const draggingSet = new Set(dragging);
  const guides: AlignGuide[] = [];
  const seen = new Set<string>();

  const add = (axis: "x" | "y", position: number, type: AlignGuide["type"]) => {
    const key = `${axis}:${Math.round(position)}`;
    if (!seen.has(key)) {
      seen.add(key);
      guides.push({ axis, position: Math.round(position), type });
    }
  };

  // Form center guides (always present).
  add("x", canvasWidth / 2, "form-center");

  // Per-field guides from non-dragged fields.
  for (const el of elements) {
    if (draggingSet.has(el.name) || !el.layout) continue;
    const layout = resolveLayout(el, activeBreakpoint);
    if (!layout) continue;

    const { x, width } = layout;
    const type: AlignGuide["type"] = el.type === "group" ? "section-edge" : "field-edge";
    const centerType: AlignGuide["type"] =
      el.type === "group" ? "section-center" : "field-center";

    // Vertical guides (x-axis): left edge, center, right edge.
    add("x", x, type);
    add("x", x + width / 2, centerType);
    add("x", x + width, type);
  }

  return guides;
}

/**
 * Given a dragged item's desired position and the active guides, snap the item
 * to the nearest guide within SNAP_THRESHOLD pixels on each axis.
 */
export function snapToGuides(
  x: number,
  y: number,
  width: number,
  height: number,
  guides: AlignGuide[],
): { x: number; y: number } {
  let snappedX = x;
  let snappedY = y;
  let bestXDist = SNAP_THRESHOLD + 1;
  let bestYDist = SNAP_THRESHOLD + 1;

  for (const g of guides) {
    if (g.axis === "x") {
      // Snap left edge, center, or right edge of dragged item.
      for (const edge of [x, x + width / 2, x + width]) {
        const d = Math.abs(edge - g.position);
        if (d < bestXDist) {
          bestXDist = d;
          snappedX = g.position - (edge - x);
        }
      }
    } else {
      for (const edge of [y, y + height / 2, y + height]) {
        const d = Math.abs(edge - g.position);
        if (d < bestYDist) {
          bestYDist = d;
          snappedY = g.position - (edge - y);
        }
      }
    }
  }

  return { x: snappedX, y: snappedY };
}
