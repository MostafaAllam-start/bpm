import type { RefObject } from "react";

type DiagramCanvasProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  propertiesRef: RefObject<HTMLDivElement | null>;
};

// The drawing surface: bpmn-js renders the canvas into `containerRef` and the
// properties panel into `propertiesRef`.
//
// The canvas is pinned to dir="ltr" even when the app runs right-to-left:
// diagram-js (and the token-simulation overlays / triggers it positions) assume
// a left-to-right coordinate system, and an inherited dir="rtl" breaks
// positioning so the simulation can't be started. The flow diagram itself reads
// left-to-right regardless of UI language.
export default function DiagramCanvas({
  containerRef,
  propertiesRef,
}: DiagramCanvasProps) {
  return (
    <div className="bpmn-body" dir="ltr">
      <div ref={containerRef} className="bpmn-canvas" />
      <div ref={propertiesRef} className="bpmn-properties" />
    </div>
  );
}
