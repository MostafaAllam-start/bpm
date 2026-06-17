import { useCallback, useEffect, useRef } from "react";

import { useHistoryStore } from "../store/historyStore.ts";
import type { FlowModeler } from "./useFlowModeler.ts";

// Wires the undo/redo history store to the live React Flow graph (the hybrid
// model). It seeds a baseline, commits a snapshot whenever edits settle
// (debounced so a drag is one history entry, not hundreds), and applies
// snapshots back to the canvas on undo/redo. Re-committing a just-restored
// snapshot is a no-op because the store dedupes by structural key.

const DEBOUNCE_MS = 350;

export function useHistory(modeler: FlowModeler) {
  const commit = useHistoryStore((s) => s.commit);
  const undoStack = useHistoryStore((s) => s.undo);
  const redoStack = useHistoryStore((s) => s.redo);
  const reset = useHistoryStore((s) => s.reset);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const { nodes, edges, getSnapshot, applySnapshot } = modeler;

  // Seed the baseline once on mount.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) {
      reset(getSnapshot());
      seeded.current = true;
    }
  }, [reset, getSnapshot]);

  // Commit settled edits.
  useEffect(() => {
    const id = setTimeout(() => commit({ nodes, edges }), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [nodes, edges, commit]);

  const undo = useCallback(() => {
    const snap = undoStack();
    if (snap) applySnapshot(snap);
  }, [undoStack, applySnapshot]);

  const redo = useCallback(() => {
    const snap = redoStack();
    if (snap) applySnapshot(snap);
  }, [redoStack, applySnapshot]);

  // Re-seed the baseline (after New / Open / Import replaces the whole graph).
  const rebase = useCallback(() => reset(getSnapshot()), [reset, getSnapshot]);

  return { undo, redo, canUndo, canRedo, rebase };
}
