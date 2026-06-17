import { useCallback } from "react";

import { useClipboardStore } from "../store/clipboardStore.ts";
import type { FlowModeler } from "./useFlowModeler.ts";

// Copy / paste / duplicate for the current selection. The buffer lives in the
// clipboard store (so a copy survives selection changes); the id-remapping and
// insertion happen in the modeler's `insertGraph`.

export function useClipboard(modeler: FlowModeler) {
  const copyToStore = useClipboardStore((s) => s.copy);
  const bumpPaste = useClipboardStore((s) => s.bumpPaste);

  // The selected nodes plus the edges entirely between them.
  const selectionSlice = useCallback(() => {
    const ids = new Set(modeler.selectedNodeIds);
    const nodes = modeler.nodes.filter((n) => ids.has(n.id));
    const edges = modeler.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges, hasSelection: ids.size > 0 };
  }, [modeler]);

  const copy = useCallback(() => {
    const { nodes, edges, hasSelection } = selectionSlice();
    if (hasSelection) copyToStore(nodes, edges);
  }, [selectionSlice, copyToStore]);

  const paste = useCallback(() => {
    const { nodes, edges } = useClipboardStore.getState();
    if (!nodes.length) return;
    const k = bumpPaste();
    modeler.insertGraph(nodes, edges, { x: 40 * k, y: 40 * k });
  }, [modeler, bumpPaste]);

  const duplicate = useCallback(() => {
    const { nodes, edges, hasSelection } = selectionSlice();
    if (hasSelection) modeler.insertGraph(nodes, edges, { x: 40, y: 40 });
  }, [selectionSlice, modeler]);

  return { copy, paste, duplicate };
}
