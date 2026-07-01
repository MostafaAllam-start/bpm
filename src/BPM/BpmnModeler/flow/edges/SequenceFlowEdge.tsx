import { memo, useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useInternalNode,
  useReactFlow,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";

import type { BpmnEdgeData } from "../types/index.ts";
import { labelStyleFrom } from "../utils/labelStyle.ts";
import { getEdgeParams } from "../utils/floatingEdge.ts";
import { useEdgeRouting } from "../EdgeRoutingContext.ts";
import { useEdgeActions } from "../EdgeActionsContext.ts";
import { useEdgeMenuStore } from "../store/edgeMenuStore.ts";
import {
  routeOrthogonal,
  routeManual,
  orthogonalize,
  simplifyColinear,
  labelPoint,
  pointsToSvgPath,
} from "../utils/orthogonalRouter.ts";
import type { Rect, RoutePoint, RouteResult } from "../utils/orthogonalRouter.ts";

// A click that travels less than this (squared px) is treated as a click (shows
// the trash button) rather than a segment drag (reshapes the route).
const DRAG_THRESHOLD_SQ = 16; // 4px
// Vertical gap (flow units) between the click point and the trash button so it
// sits clear of the line and the cursor.
const TRASH_GAP = 28;
// Radius (flow units) of the accent dots marking a selected edge's start/end.
const ENDPOINT_R = 4;
// How far (flow units) to pull those dots inward along the edge, off the node
// border into the visible gap — nodes paint on top of the edges layer, so a dot
// left on the border would be hidden behind its node.
const ENDPOINT_INSET = 10;

// A point `dist` along the segment from `from` toward `toward` (clamped to the
// segment so a short stub just lands on its bend).
function alongFrom(from: RoutePoint, toward: RoutePoint, dist: number): RoutePoint {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: from.x, y: from.y };
  const d = Math.min(dist, len);
  return { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d };
}

const TRASH_ICON = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const TrashIcon = () => (
  <svg {...TRASH_ICON}>
    <path d="M4 7h16M10 7V4.5h4V7M6.5 7l.9 12.5h9.2L17.5 7" />
  </svg>
);

// Build the obstacle-avoiding route between two endpoints, or null to fall back
// to a simple step path: while a node is dragging (cheap path then), when a node
// rect is momentarily missing, or when no clean path is found. Kept a plain
// function (not a hook) so the edge can bail out early on a missing node.
function routeAround(
  obstacles: Map<string, Rect>,
  dragging: boolean,
  source: string,
  target: string,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sourcePos: Position,
  targetPos: Position,
): RouteResult | null {
  if (dragging) return null;
  const s = obstacles.get(source);
  const t = obstacles.get(target);
  if (!s || !t) return null;
  const obs: Rect[] = [];
  for (const [nid, r] of obstacles) {
    if (nid !== source && nid !== target) obs.push(r);
  }
  return routeOrthogonal({
    source: s,
    target: t,
    obstacles: obs,
    start: { x: sx, y: sy, side: sourcePos },
    end: { x: tx, y: ty, side: targetPos },
  });
}

// The default centred right-angle step between two floating anchors (matching
// getSmoothStepPath with borderRadius 0). getEdgeParams always returns a matching
// orientation pair (both horizontal or both vertical), so a single mid-line bend
// suffices; simplifyColinear collapses it to a straight line when the anchors
// already share a row/column. Returned as points so the same polyline drives both
// the drawn path and the drag handles.
function stepPolyline(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  horizontal: boolean,
): RoutePoint[] {
  const raw: RoutePoint[] = horizontal
    ? [
        { x: sx, y: sy },
        { x: (sx + tx) / 2, y: sy },
        { x: (sx + tx) / 2, y: ty },
        { x: tx, y: ty },
      ]
    : [
        { x: sx, y: sy },
        { x: sx, y: (sy + ty) / 2 },
        { x: tx, y: (sy + ty) / 2 },
        { x: tx, y: ty },
      ];
  return simplifyColinear(raw);
}

// Snapshot taken when a segment drag starts, read by the move/up handlers.
type DragState = {
  pointerId: number;
  segIndex: number;
  base: RoutePoint[];
  horizontal: boolean;
  downX: number;
  downY: number;
  moved: boolean;
  sourcePos: Position;
  targetPos: Position;
  anchorS: RoutePoint;
  anchorT: RoutePoint;
};

// A BPMN sequence flow: an orthogonal arrow between two elements. The endpoints
// "float": each attaches to the side of its node that faces the other node and
// re-routes as the nodes move (see getEdgeParams). When the user has dragged the
// edge, its hand-placed interior corners (data.waypoints) drive the route;
// otherwise the obstacle-avoiding router runs, falling back to a simple step.
// While selected, transparent per-segment handles let the user drag a segment to
// reshape the route (kept strictly orthogonal); a double-click resets it. The
// midpoint label is the flow's name/label, or the raw condition as a fallback.
function SequenceFlowEdgeImpl({
  id,
  source,
  target,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const d = (data ?? {}) as BpmnEdgeData;
  const { t } = useTranslation("bpmn");
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const { obstacles, dragging } = useEdgeRouting();
  const edgeActions = useEdgeActions();
  const { screenToFlowPosition } = useReactFlow();
  // Only the edge whose id matches the stored click point renders the trash.
  const trash = useEdgeMenuStore((s) => (s.trash && s.trash.edgeId === id ? s.trash : null));

  const dragRef = useRef<DragState | null>(null);
  // While a drag is in flight the handles render from this frozen snapshot (not
  // the live, changing route), so the captured handle element keeps its identity.
  // null when idle → handles follow the drawn path.
  const [frozenBase, setFrozenBase] = useState<RoutePoint[] | null>(null);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
  const horizontal = sourcePos === Position.Left || sourcePos === Position.Right;

  // The route polyline: hand-dragged waypoints win; otherwise the obstacle router
  // (null/!ok → centred step). Always resolved to a points array so the handles
  // line up exactly with the drawn path.
  const manual =
    d.waypoints && d.waypoints.length > 0
      ? routeManual({ x: sx, y: sy }, { x: tx, y: ty }, d.waypoints, sourcePos, targetPos)
      : null;
  const route =
    manual ?? routeAround(obstacles, dragging, source, target, sx, sy, tx, ty, sourcePos, targetPos);

  let points: RoutePoint[];
  let labelX: number;
  let labelY: number;
  if (route && route.ok) {
    points = route.points;
    labelX = route.labelX;
    labelY = route.labelY;
  } else {
    points = stepPolyline(sx, sy, tx, ty, horizontal);
    const lp = labelPoint(points);
    labelX = lp.labelX;
    labelY = lp.labelY;
  }
  const path = pointsToSvgPath(points);

  // The label shown on the arrow: the flow's own name/label takes precedence,
  // falling back to the raw condition expression when no label is set.
  const label = d.name || d.conditionExpression;

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

  // --- Segment drag: reshape the route while keeping every angle at 90°. -------

  const onHandlePointerDown = (
    e: ReactPointerEvent<SVGPathElement>,
    segIndex: number,
    segHorizontal: boolean,
  ) => {
    if (e.button !== 0) return;
    // No stopPropagation: a plain click must still reach React Flow to select the
    // edge and fire onEdgeClick (which positions the trash). A drag stops
    // propagation itself once it crosses the move threshold.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      segIndex,
      base: points,
      horizontal: segHorizontal,
      downX: e.clientX,
      downY: e.clientY,
      moved: false,
      sourcePos,
      targetPos,
      anchorS: { x: sx, y: sy },
      anchorT: { x: tx, y: ty },
    };
    setFrozenBase(points);
  };

  const onHandlePointerMove = (e: ReactPointerEvent<SVGPathElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.downX;
    const dy = e.clientY - drag.downY;
    if (!drag.moved && dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
    if (!drag.moved) {
      drag.moved = true;
      useEdgeMenuStore.getState().setTrash(null); // hide the trash while reshaping
    }
    e.stopPropagation(); // suppress click/select + pane interactions mid-drag

    const cursor = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const work = drag.base.map((pt) => ({ ...pt }));
    const k = drag.segIndex;
    if (drag.horizontal) {
      work[k].y = cursor.y;
      work[k + 1].y = cursor.y;
    } else {
      work[k].x = cursor.x;
      work[k + 1].x = cursor.x;
    }
    // Interior corners to keep. A segment endpoint that is itself an anchor gets
    // pinned as a waypoint (its dragged position), so orthogonalize can stitch the
    // fixed anchor to it with a clean stub instead of dropping the drag.
    const n = work.length;
    let interior = work.slice(1, n - 1);
    if (k === 0) interior = [work[0], ...interior];
    if (k + 1 === n - 1) interior = [...interior, work[n - 1]];

    const normalized = simplifyColinear(
      orthogonalize([drag.anchorS, ...interior, drag.anchorT], drag.sourcePos, drag.targetPos),
    ).slice(1, -1);
    edgeActions.setWaypoints(id, normalized);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<SVGPathElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setFrozenBase(null);
  };

  const onHandleDoubleClick = (e: ReactMouseEvent) => {
    if (!d.waypoints?.length) return;
    e.stopPropagation();
    edgeActions.clearWaypoints(id);
    useEdgeMenuStore.getState().setTrash(null);
  };

  // Handles show whenever the edge is selected and no node is mid-drag. During a
  // segment drag they stay frozen to the snapshot so the captured element keeps
  // its identity (the drawn path still updates live from the new waypoints).
  const showHandles = selected && !dragging;
  const handlePoints = frozenBase ?? points;
  const showTrash = Boolean(selected && trash);

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
      {showHandles &&
        handlePoints.slice(0, -1).map((a, i) => {
          const b = handlePoints[i + 1];
          const segDx = Math.abs(a.x - b.x);
          const segDy = Math.abs(a.y - b.y);
          if (segDx < 0.5 && segDy < 0.5) return null; // zero-length
          const segHorizontal = segDy < segDx;
          return (
            <path
              key={i}
              className="bf-edge-handle nopan"
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              style={{
                fill: "none",
                stroke: "transparent",
                strokeWidth: 12,
                pointerEvents: "stroke",
                cursor: segHorizontal ? "ns-resize" : "ew-resize",
              }}
              onPointerDown={(e) => onHandlePointerDown(e, i, segHorizontal)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onDoubleClick={onHandleDoubleClick}
            />
          );
        })}
      {selected &&
        (() => {
          // Pull the markers just inside each end so they clear the node bodies
          // (which render above the edges layer) yet still read as start/end.
          const startDot = alongFrom(points[0], points[1], ENDPOINT_INSET);
          const endDot = alongFrom(
            points[points.length - 1],
            points[points.length - 2],
            ENDPOINT_INSET,
          );
          return (
            <>
              {/* Accent markers at the flow's start and end, shown while selected. */}
              <circle className="bf-edge-endpoint" cx={startDot.x} cy={startDot.y} r={ENDPOINT_R} />
              <circle className="bf-edge-endpoint" cx={endDot.x} cy={endDot.y} r={ENDPOINT_R} />
            </>
          );
        })()}
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
      {showTrash && trash && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="bf-edge-trash nodrag nopan"
            title={t("edge.delete")}
            aria-label={t("edge.delete")}
            style={{
              transform: `translate(-50%, -50%) translate(${trash.x}px, ${
                trash.y + (trash.below ? TRASH_GAP : -TRASH_GAP)
              }px)`,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              edgeActions.deleteEdge(id);
              useEdgeMenuStore.getState().setTrash(null);
            }}
          >
            <TrashIcon />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SequenceFlowEdge = memo(SequenceFlowEdgeImpl);
