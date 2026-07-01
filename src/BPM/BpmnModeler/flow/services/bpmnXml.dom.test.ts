// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

import { toBpmnXml } from "./toBpmnXml.ts";
import { BpmnParseError, fromBpmnXml } from "./fromBpmnXml.ts";
import type { BpmnNode, FlowDiagram } from "../types/index.ts";
import type { SavedActorForm } from "../../types.ts";
import type { FormSchema } from "@FormBuilder";

// Round-trip suite — runs in jsdom because `fromBpmnXml` uses DOMParser. Locks
// the XML serializer/parser contract the moves in later phases must preserve.

const node = (id: string, bpmnType: BpmnNode["data"]["bpmnType"], x: number, name = ""): BpmnNode => ({
  id,
  type: "event",
  position: { x, y: 100 },
  data: { bpmnType, name, props: {} },
});

const diagram = (over: Partial<FlowDiagram>): FlowDiagram => ({
  processId: "Process_1",
  processName: "",
  isExecutable: true,
  processProps: {},
  processVariables: [],
  allowedActors: [],
  nodes: [],
  edges: [],
  ...over,
});

describe("toBpmnXml / fromBpmnXml round-trip", () => {
  it("preserves node ids, positions, names, and the edge", () => {
    const d = diagram({
      nodes: [node("Start_1", "startEvent", 100, "Start"), node("End_1", "endEvent", 300, "Done")],
      edges: [{ id: "Flow_1", source: "Start_1", target: "End_1", type: "sequenceFlow" }],
    });

    const back = fromBpmnXml(toBpmnXml(d).xml);

    expect(back.nodes.map((n) => n.id)).toEqual(["Start_1", "End_1"]);
    expect(back.nodes[0].position).toEqual({ x: 100, y: 100 });
    expect(back.nodes[0].data.name).toBe("Start");
    expect(back.nodes[1].data.name).toBe("Done");
    expect(back.edges).toHaveLength(1);
    expect(back.edges[0]).toMatchObject({ id: "Flow_1", source: "Start_1", target: "End_1" });
  });

  it("escapes special characters in names", () => {
    const d = diagram({ nodes: [node("S", "startEvent", 0, "A & B")] });
    const { xml } = toBpmnXml(d);
    expect(xml).toContain("A &amp; B");
    expect(xml).not.toContain('name="A & B"');
    expect(fromBpmnXml(xml).nodes[0].data.name).toBe("A & B");
  });

  it("extracts process variables from an embedded form", () => {
    const schema: FormSchema = { pages: [{ name: "p", elements: [{ type: "text", name: "a", id: "f1" }] }] };
    const savedActorForms: Record<string, SavedActorForm> = {
      Task_1: { actorLabel: "T1", schema },
    };
    const d = diagram({
      nodes: [{ id: "Task_1", type: "task", position: { x: 0, y: 0 }, data: { bpmnType: "userTask", name: "T1", props: {} } }],
    });
    const { variables } = toBpmnXml(d, { savedActorForms });
    expect(variables).toEqual([
      expect.objectContaining({ name: "a", ref: "f1", type: "string", sourceTask: "Task_1" }),
    ]);
  });

  it("round-trips a global variable", () => {
    const d = diagram({
      nodes: [node("S", "startEvent", 0)],
      processVariables: [{ name: "gv", type: "number", source: "manual", value: "5" }],
    });
    const back = fromBpmnXml(toBpmnXml(d).xml);
    expect(back.processVariables).toEqual([
      { name: "gv", type: "number", source: "manual", value: "5" },
    ]);
  });

  it("round-trips a hand-dragged edge route through DI waypoints", () => {
    const d = diagram({
      nodes: [node("Start_1", "startEvent", 100), node("End_1", "endEvent", 300)],
      edges: [
        {
          id: "Flow_1",
          source: "Start_1",
          target: "End_1",
          type: "sequenceFlow",
          data: { waypoints: [{ x: 150, y: 220 }, { x: 318, y: 220 }] },
        },
      ],
    });

    const { xml } = toBpmnXml(d);
    // Source centre + 2 interior corners + target centre = 4 waypoints.
    expect((xml.match(/<di:waypoint /g) ?? [])).toHaveLength(4);

    const back = fromBpmnXml(xml);
    expect(back.edges[0].data?.waypoints).toEqual([
      { x: 150, y: 220 },
      { x: 318, y: 220 },
    ]);
  });

  it("leaves a plain 2-point edge on the auto-router (no waypoints)", () => {
    const d = diagram({
      nodes: [node("Start_1", "startEvent", 100), node("End_1", "endEvent", 300)],
      edges: [{ id: "Flow_1", source: "Start_1", target: "End_1", type: "sequenceFlow" }],
    });
    const back = fromBpmnXml(toBpmnXml(d).xml);
    expect(back.edges[0].data?.waypoints).toBeUndefined();
  });

  it("throws BpmnParseError for a non-BPMN document", () => {
    expect(() => fromBpmnXml("<garbage/>")).toThrow(BpmnParseError);
  });
});
