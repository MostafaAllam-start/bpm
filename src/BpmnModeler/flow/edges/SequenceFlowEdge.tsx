import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useInternalNode,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { BpmnEdgeData } from "../types/index.ts";
import { labelStyleFrom } from "../utils/labelStyle.ts";
import { getEdgeParams } from "../utils/floatingEdge.ts";

// A BPMN sequence flow: an orthogonal arrow between two elements. The endpoints
// "float": each attaches to the side of its node that faces the other node and
// re-routes as the nodes move (see getEdgeParams), rather than pinning to a
// fixed handle. Conditional flows show their condition expression (or an
// explicit name) as a midpoint label; the gateway's default flow gets a slash.
function SequenceFlowEdgeImpl({
  id,
  source,
  target,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const d = (data ?? {}) as BpmnEdgeData;
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
  // borderRadius 0 → clean right-angle (orthogonal) bends, like Camunda.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    borderRadius: 0,
  });

  const label = d.conditionExpression || d.name;

  // Connector appearance (stored as ecmplus props, so it round-trips). The line
  // pattern, colour and width are all optional; a connector with a custom colour
  // gets a matching arrowhead via an inline marker.
  const p = d.props ?? {};
  const dash =
    p.lineStyle === "dashed" ? "6 4" : p.lineStyle === "dotted" ? "1.5 4" : undefined;
  const width = p.lineWidth ? Number(p.lineWidth) : selected ? 2 : 1.5;
  const custom = Boolean(p.lineColor);
  const markerId = `bf-arrow-${id}`;
  const edgeStyle: CSSProperties = { strokeWidth: width };
  if (custom) edgeStyle.stroke = p.lineColor;
  if (dash) {
    edgeStyle.strokeDasharray = dash;
    if (p.lineStyle === "dotted") edgeStyle.strokeLinecap = "round";
  }

  return (
    <>
      {custom && (
        <defs>
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M1,1 L9,5 L1,9 z" fill={p.lineColor} />
          </marker>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={custom ? `url(#${markerId})` : markerEnd}
        style={edgeStyle}
      />
      {(label || d.isDefault) && (
        <EdgeLabelRenderer>
          <div
            className="bf-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              ...labelStyleFrom(d.props),
            }}
          >
            {d.isDefault && <span className="bf-edge-default" aria-hidden>/</span>}
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SequenceFlowEdge = memo(SequenceFlowEdgeImpl);
