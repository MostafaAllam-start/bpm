import { create } from "zustand";

// Where the per-edge trash button sits, set when an edge is clicked and read by
// the matching SequenceFlowEdge. Kept in a tiny store (not edge.data, which would
// round-trip to XML) so the click point — captured by FlowCanvas's onEdgeClick —
// reaches the edge component without prop threading. Only the currently selected
// edge whose id matches renders the button, so clearing on deselect is implicit.
export type EdgeTrash = {
  edgeId: string;
  // Anchor point in flow coords (the click position).
  x: number;
  y: number;
  // Place the button below the line (true) instead of above — set when the click
  // is near the top of the canvas so the button never spills off-screen.
  below: boolean;
};

type EdgeMenuState = {
  trash: EdgeTrash | null;
  setTrash: (trash: EdgeTrash | null) => void;
};

export const useEdgeMenuStore = create<EdgeMenuState>((set) => ({
  trash: null,
  setTrash: (trash) => set({ trash }),
}));
