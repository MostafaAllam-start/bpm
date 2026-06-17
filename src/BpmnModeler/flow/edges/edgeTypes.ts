import { SequenceFlowEdge } from "./SequenceFlowEdge.tsx";

// Maps a React Flow edge `type` to its component. Kept separate from the
// component module so that file only exports components (Fast Refresh).
export const edgeTypes = {
  sequenceFlow: SequenceFlowEdge,
};
