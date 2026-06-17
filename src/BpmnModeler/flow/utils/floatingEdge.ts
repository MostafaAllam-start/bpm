import { Position } from "@xyflow/react";
import type { InternalNode, Node } from "@xyflow/react";

// Geometry for "floating" edges. Each endpoint attaches to the middle of the
// node side that faces the other node: the dominant direction between the two
// centres picks a horizontal (left/right) or vertical (top/bottom) side, and the
// connection point is that side's mid-point. The edge re-routes automatically as
// either node moves.

function dimensions(node: InternalNode<Node>): { x: number; y: number; w: number; h: number } {
  const pos = node.internals.positionAbsolute;
  return { x: pos.x, y: pos.y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

export type EdgeParams = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
};

// The facing side mid-points (and sides) for a source→target pair.
export function getEdgeParams(
  source: InternalNode<Node>,
  target: InternalNode<Node>,
): EdgeParams {
  const s = dimensions(source);
  const t = dimensions(target);

  const scx = s.x + s.w / 2;
  const scy = s.y + s.h / 2;
  const tcx = t.x + t.w / 2;
  const tcy = t.y + t.h / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  // Horizontal vs vertical depending on which axis the other node is further on.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sx: s.x + s.w, sy: scy, tx: t.x, ty: tcy, sourcePos: Position.Right, targetPos: Position.Left }
      : { sx: s.x, sy: scy, tx: t.x + t.w, ty: tcy, sourcePos: Position.Left, targetPos: Position.Right };
  }
  return dy >= 0
    ? { sx: scx, sy: s.y + s.h, tx: tcx, ty: t.y, sourcePos: Position.Bottom, targetPos: Position.Top }
    : { sx: scx, sy: s.y, tx: tcx, ty: t.y + t.h, sourcePos: Position.Top, targetPos: Position.Bottom };
}
