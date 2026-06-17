import { create } from "zustand";

import type { BpmnEdge, BpmnNode } from "../types/index.ts";

// The copy/paste buffer. Holds a deep-cloned slice of the graph (the selected
// nodes plus the edges wholly between them). `useClipboard` reads/writes it and
// performs the id-remapping on paste.

type ClipboardState = {
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  // How many times the current buffer has been pasted, so each paste lands at a
  // growing offset instead of stacking on the last one.
  pasteCount: number;
  copy: (nodes: BpmnNode[], edges: BpmnEdge[]) => void;
  bumpPaste: () => number;
  hasContent: () => boolean;
};

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  nodes: [],
  edges: [],
  pasteCount: 0,
  copy: (nodes, edges) =>
    set({
      // Structured clone so later edits to the live graph don't mutate the buffer.
      nodes: nodes.map((n) => structuredClone(n)),
      edges: edges.map((e) => structuredClone(e)),
      pasteCount: 0,
    }),
  bumpPaste: () => {
    const next = get().pasteCount + 1;
    set({ pasteCount: next });
    return next;
  },
  hasContent: () => get().nodes.length > 0,
}));
