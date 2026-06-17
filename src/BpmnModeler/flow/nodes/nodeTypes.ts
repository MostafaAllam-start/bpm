import { EventNode, TaskNode, GatewayNode } from "./index.tsx";

// Maps a React Flow node `type` (our BPMN visual category) to its component.
// Kept separate from the component module so the components file only exports
// components (React Fast Refresh requirement).
export const nodeTypes = {
  event: EventNode,
  task: TaskNode,
  gateway: GatewayNode,
};
