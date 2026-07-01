// React Flow ships its own stylesheet for the canvas, controls, minimap and
// handles. Our overrides (BPMN shape styling, palette, properties panel) live in
// BpmnModeler.css.
import "@xyflow/react/dist/style.css";
import "./BpmnModeler.css";

import { ReactFlowProvider } from "@xyflow/react";

import FlowCanvas from "./flow/FlowCanvas.tsx";
import type { BpmnEditorProps } from "./types.ts";

// The BPMN modeler, rebuilt on React Flow (replacing bpmn-js). This thin shell
// provides the React Flow context the canvas and its hooks need; all behaviour
// lives in `./flow`.
export default function BpmnEditor(props: BpmnEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
