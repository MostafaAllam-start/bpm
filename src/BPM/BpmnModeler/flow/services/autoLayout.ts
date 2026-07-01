import dagre from "@dagrejs/dagre";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnEdge, BpmnNode } from "../types/index.ts";

// Auto-layout: arrange the graph left-to-right with dagre and return the nodes
// with updated positions (a pure transform — the caller applies them). Used by
// the toolbar's "Auto-layout" action and after importing a diagram that has no
// usable coordinates.

export function autoLayout(
  nodes: BpmnNode[],
  edges: BpmnEdge[],
  direction: "LR" | "TB" = "LR",
): BpmnNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const spec = ELEMENT_SPECS[node.data.bpmnType];
    g.setNode(node.id, {
      width: (node.width as number) || spec.width,
      // Tasks auto-size; their real height is on `measured`, not `height`.
      height:
        (node.height as number) || (node.measured?.height as number) || spec.height,
    });
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const laid = g.node(node.id);
    if (!laid) return node;
    // dagre returns the node centre; React Flow positions by the top-left corner.
    return {
      ...node,
      position: { x: laid.x - laid.width / 2, y: laid.y - laid.height / 2 },
    };
  });
}
