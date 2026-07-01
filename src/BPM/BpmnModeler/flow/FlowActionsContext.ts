import { createContext, useContext } from "react";

import type { BpmnElementType } from "./types/index.ts";

// Actions the node context pad needs, provided by FlowCanvas. Kept in a context
// so the React Flow node components (which can't receive arbitrary props) can
// reach the modeler operations without threading callbacks through node data.
export type FlowActions = {
  // Create a new element of `type` connected after the source node.
  append: (sourceId: string, type: BpmnElementType) => void;
  // Delete the node and its flows.
  remove: (id: string) => void;
  // Set the node's fill/stroke (undefined clears back to the default colour).
  setColor: (id: string, fill?: string, stroke?: string) => void;
};

export const FlowActionsContext = createContext<FlowActions | null>(null);

export function useFlowActions(): FlowActions {
  const ctx = useContext(FlowActionsContext);
  if (!ctx) throw new Error("useFlowActions must be used within FlowActionsContext");
  return ctx;
}
