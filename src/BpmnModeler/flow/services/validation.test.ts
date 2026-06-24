import { describe, expect, it } from "vitest";

import { validateWorkflow } from "./validation.ts";
import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnEdge, BpmnElementType, BpmnNode } from "../types/index.ts";

function node(id: string, bpmnType: BpmnElementType): BpmnNode {
  return {
    id,
    type: ELEMENT_SPECS[bpmnType].category,
    position: { x: 0, y: 0 },
    data: { bpmnType, name: "", props: {} },
  };
}

function edge(id: string, source: string, target: string): BpmnEdge {
  return { id, source, target };
}

const keys = (r: ReturnType<typeof validateWorkflow>) => r.issues.map((i) => i.messageKey);

describe("validateWorkflow — single end rule", () => {
  it("flags every end event when there is more than one", () => {
    const nodes = [
      node("Start", "startEvent"),
      node("Task", "task"),
      node("End1", "endEvent"),
      node("End2", "endEvent"),
    ];
    const edges = [
      edge("f1", "Start", "Task"),
      edge("f2", "Task", "End1"),
      edge("f3", "Task", "End2"),
    ];
    const result = validateWorkflow(nodes, edges);
    const multi = result.issues.filter((i) => i.messageKey === "validation.multipleEnd");
    expect(multi).toHaveLength(2);
    expect(result.ok).toBe(false);
  });

  it("accepts a single end event", () => {
    const nodes = [node("Start", "startEvent"), node("Task", "task"), node("End", "endEvent")];
    const edges = [edge("f1", "Start", "Task"), edge("f2", "Task", "End")];
    expect(keys(validateWorkflow(nodes, edges))).not.toContain("validation.multipleEnd");
  });
});

describe("validateWorkflow — open-end reachability warning", () => {
  it("warns about a connected branch that never reaches the end event", () => {
    // Start fans out to the end and to a catch event that dead-ends.
    const nodes = [
      node("Start", "startEvent"),
      node("Catch", "intermediateCatchEvent"),
      node("End", "endEvent"),
    ];
    const edges = [edge("f1", "Start", "End"), edge("f2", "Start", "Catch")];
    const result = validateWorkflow(nodes, edges);
    const open = result.issues.filter((i) => i.messageKey === "validation.openEnd");
    expect(open).toHaveLength(1);
    expect(open[0].nodeId).toBe("Catch");
    expect(open[0].severity).toBe("warning");
  });

  it("does not warn when every node reaches the end event", () => {
    const nodes = [node("Start", "startEvent"), node("Task", "task"), node("End", "endEvent")];
    const edges = [edge("f1", "Start", "Task"), edge("f2", "Task", "End")];
    expect(keys(validateWorkflow(nodes, edges))).not.toContain("validation.openEnd");
  });
});
