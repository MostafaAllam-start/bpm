import { create } from "zustand";

import type { BpmnEdge, BpmnNode } from "../types/index.ts";

// Undo/redo history for the workflow graph (the hybrid model: React Flow owns
// the live nodes/edges via its hooks; this Zustand store only keeps the
// snapshot stacks). `useHistory` records committed snapshots here and applies
// them back to the modeler on undo/redo.

export type Snapshot = { nodes: BpmnNode[]; edges: BpmnEdge[] };

// A cheap structural fingerprint, so repeatedly committing an unchanged graph
// (or re-committing a snapshot we just restored) is a no-op.
export function snapshotKey(snap: Snapshot): string {
  const n = snap.nodes
    .map((x) => `${x.id}:${x.position.x},${x.position.y}:${JSON.stringify(x.data)}`)
    .join("|");
  const e = snap.edges
    .map((x) => `${x.id}:${x.source}>${x.target}:${JSON.stringify(x.data ?? {})}:${x.sourceHandle ?? ""}>${x.targetHandle ?? ""}`)
    .join("|");
  return `${n}#${e}`;
}

type HistoryState = {
  past: Snapshot[];
  future: Snapshot[];
  present: Snapshot | null;
  presentKey: string;
  // Record a new committed state. No-op if identical to the present snapshot.
  commit: (snap: Snapshot) => void;
  // Move one step back / forward, returning the snapshot to apply (or null).
  undo: () => Snapshot | null;
  redo: () => Snapshot | null;
  // Re-seed the history with a fresh baseline (New / Open / Import).
  reset: (snap: Snapshot) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const LIMIT = 100;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  present: null,
  presentKey: "",

  commit: (snap) => {
    const { present, presentKey, past } = get();
    const key = snapshotKey(snap);
    if (key === presentKey) return; // nothing actually changed
    set({
      past: present ? [...past, present].slice(-LIMIT) : past,
      present: snap,
      presentKey: key,
      future: [],
    });
  },

  undo: () => {
    const { past, present } = get();
    if (!past.length || !present) return null;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      present: prev,
      presentKey: snapshotKey(prev),
      future: [present, ...get().future],
    });
    return prev;
  },

  redo: () => {
    const { future, present } = get();
    if (!future.length || !present) return null;
    const next = future[0];
    set({
      future: future.slice(1),
      present: next,
      presentKey: snapshotKey(next),
      past: [...get().past, present],
    });
    return next;
  },

  reset: (snap) =>
    set({ past: [], future: [], present: snap, presentKey: snapshotKey(snap) }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
