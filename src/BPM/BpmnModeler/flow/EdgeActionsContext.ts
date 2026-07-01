import { createContext, useContext } from "react";

// Actions a sequence-flow edge component needs, provided by FlowCanvas. Kept in a
// context (like FlowActionsContext for nodes) because React Flow edge components
// can't receive arbitrary props, and they must mutate through the modeler's
// controlled `setEdges` — calling useReactFlow().setEdges directly would be
// overwritten by the controlled `edges` prop on the next render.
export type EdgeActions = {
  // Remove the edge (the per-edge trash button).
  deleteEdge: (id: string) => void;
  // Persist the hand-dragged orthogonal route (interior corner points).
  setWaypoints: (id: string, waypoints: { x: number; y: number }[]) => void;
  // Drop the manual route, reverting to automatic routing (double-click).
  clearWaypoints: (id: string) => void;
};

export const EdgeActionsContext = createContext<EdgeActions | null>(null);

export function useEdgeActions(): EdgeActions {
  const ctx = useContext(EdgeActionsContext);
  if (!ctx) throw new Error("useEdgeActions must be used within EdgeActionsContext");
  return ctx;
}
