import { createContext, useContext } from "react";

import { ELEMENT_SPECS } from "./types/index.ts";
import type { BpmnNode } from "./types/index.ts";
import type { Rect } from "./utils/orthogonalRouter.ts";

// Shared input for obstacle-aware edge routing. FlowCanvas computes the node
// rect map once per nodes change and provides it here, so each edge reads the
// same obstacle set instead of scanning the React Flow store independently.
// `dragging` gates the routing: while a node is being dragged, edges fall back
// to the cheap getSmoothStepPath and only re-route (run A*) once it settles.
export type EdgeRouting = {
  obstacles: Map<string, Rect>;
  dragging: boolean;
};

const EMPTY: EdgeRouting = { obstacles: new Map(), dragging: false };

export const EdgeRoutingContext = createContext<EdgeRouting>(EMPTY);

export function useEdgeRouting(): EdgeRouting {
  return useContext(EdgeRoutingContext);
}

// Each node's bounding rect (absolute coords — the graph is flat, no subflows).
// Prefers the measured size, falling back to the declared/spec size for a node
// not yet measured (e.g. a just-added task whose height grows to fit).
export function buildObstacleMap(nodes: BpmnNode[]): Map<string, Rect> {
  const map = new Map<string, Rect>();
  for (const n of nodes) {
    const spec = ELEMENT_SPECS[n.data.bpmnType];
    const width = (n.measured?.width as number) ?? (n.width as number) ?? spec.width;
    const height = (n.measured?.height as number) ?? (n.height as number) ?? spec.height;
    map.set(n.id, { x: n.position.x, y: n.position.y, width, height });
  }
  return map;
}
