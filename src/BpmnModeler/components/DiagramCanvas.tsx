import type { RefObject } from "react";

type DiagramCanvasProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  propertiesRef: RefObject<HTMLDivElement | null>;
};

// The drawing surface: bpmn-js renders the canvas into `containerRef` and the
// properties panel into `propertiesRef`.
export default function DiagramCanvas({
  containerRef,
  propertiesRef,
}: DiagramCanvasProps) {
  return (
    <div className="bpmn-body">
      <div ref={containerRef} className="bpmn-canvas" />
      <div ref={propertiesRef} className="bpmn-properties" />
    </div>
  );
}
