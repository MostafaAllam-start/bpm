import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ViewportPortal, useReactFlow } from "@xyflow/react";

import { titleStyleFrom } from "../utils/labelStyle.ts";

type ProcessTitleProps = {
  // The title text — the process name shown on the canvas.
  text: string;
  // The process props carrying the title's font styling and (x, y) position.
  props: Record<string, string>;
  // Fallback flow-space position used until the title has been dragged.
  defaultPosition: { x: number; y: number };
  // Persist a new flow-space position (called continuously while dragging).
  onMove: (x: number, y: number) => void;
  // Focus the process: clears any node/edge selection so the properties panel
  // shows the process's own properties. Called when the title is clicked.
  onSelect: () => void;
};

// The process title banner. Rendered inside the React Flow viewport (via
// ViewportPortal) so it pans, zooms and exports to SVG together with the
// diagram, and can be dragged to any spot on the canvas. Its position is stored
// in flow coordinates as the `titleX` / `titleY` process props.
export default function ProcessTitle({ text, props, defaultPosition, onMove, onSelect }: ProcessTitleProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  // Offset (flow space) between the grab point and the title's origin, so the
  // banner doesn't jump under the cursor when a drag starts.
  const grab = useRef({ x: 0, y: 0 });

  const x = props.titleX ? Number(props.titleX) : defaultPosition.x;
  const y = props.titleY ? Number(props.titleY) : defaultPosition.y;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Keep the click from starting a canvas pan / clearing the selection.
    e.stopPropagation();
    // Clicking the title focuses the process, so the properties panel shows the
    // process's properties.
    onSelect();
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    grab.current = { x: flow.x - x, y: flow.y - y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    onMove(Math.round(flow.x - grab.current.x), Math.round(flow.y - grab.current.y));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <ViewportPortal>
      <div
        className={`bf-process-title nopan${dragging ? " bf-process-title-dragging" : ""}`}
        style={{ transform: `translate(${x}px, ${y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span style={titleStyleFrom(props)}>{text}</span>
      </div>
    </ViewportPortal>
  );
}
