import { describe, it, expect } from "vitest";

import {
  availableVariablesAt,
  coerceVariableValue,
  collectUpstreamNodeIds,
  groupAvailableVariables,
  rawValueFromFetched,
  variableTypeOf,
  variablesFromForm,
  type AvailableVariable,
} from "./variables";
import type { BpmnEdge, BpmnNode } from "../types/index.ts";
import type { SavedActorForm } from "../../types.ts";
import type { FormSchema } from "@FormBuilder";

// The seam anchor: these pin the variable producer/scope logic the
// type-unification refactor must NOT change.

const formWith = (name: string, id: string): FormSchema => ({
  pages: [{ name: "p", elements: [{ type: "text", name, id }] }],
});

const taskNode = (id: string, name = id): BpmnNode => ({
  id,
  type: "task",
  position: { x: 0, y: 0 },
  data: { bpmnType: "userTask", name, props: {} },
});

const edge = (source: string, target: string): BpmnEdge => ({
  id: `${source}->${target}`,
  source,
  target,
});

describe("variableTypeOf", () => {
  it("maps field types to coarse variable types", () => {
    expect(variableTypeOf("number")).toBe("number");
    expect(variableTypeOf("rating")).toBe("number");
    expect(variableTypeOf("boolean")).toBe("boolean");
    expect(variableTypeOf("date")).toBe("date");
    expect(variableTypeOf("datetime")).toBe("date");
    expect(variableTypeOf("checkbox")).toBe("array");
    expect(variableTypeOf("fileupload")).toBe("file");
    expect(variableTypeOf("imageupload")).toBe("file");
    expect(variableTypeOf("signature")).toBe("signature");
    expect(variableTypeOf("signatureupload")).toBe("signature");
    expect(variableTypeOf("text")).toBe("string");
  });
});

describe("variablesFromForm", () => {
  it("produces one variable per answerable field, excluding display-only types", () => {
    const schema: FormSchema = {
      pages: [
        {
          name: "p",
          elements: [
            { type: "text", name: "a", id: "f1", isRequired: true },
            { type: "group", name: "g" },
            { type: "html", name: "h" },
          ],
        },
      ],
    };
    const vars = variablesFromForm(schema, "t1", "Task 1");
    expect(vars).toEqual([
      {
        name: "a",
        ref: "f1",
        type: "string",
        required: true,
        fieldId: "f1",
        sourceTask: "t1",
        sourceActor: "Task 1",
      },
    ]);
  });

  it("falls back to the field name as ref when there is no id", () => {
    const schema: FormSchema = { pages: [{ name: "p", elements: [{ type: "text", name: "a" }] }] };
    expect(variablesFromForm(schema, "t1")[0].ref).toBe("a");
  });
});

describe("coerceVariableValue", () => {
  it("coerces by declared type", () => {
    expect(coerceVariableValue("number", "3")).toBe(3);
    expect(coerceVariableValue("number", "abc")).toBe("abc");
    expect(coerceVariableValue("boolean", "true")).toBe(true);
    expect(coerceVariableValue("boolean", "false")).toBe(false);
    expect(coerceVariableValue("array", "a, b")).toEqual(["a", "b"]);
    expect(coerceVariableValue("string", "x")).toBe("x");
  });
});

describe("rawValueFromFetched", () => {
  it("joins array items, plucking a key", () => {
    expect(rawValueFromFetched([{ n: "a" }, { n: "b" }], "array", "n")).toBe("a, b");
  });
  it("stringifies a scalar", () => {
    expect(rawValueFromFetched(5, "number")).toBe("5");
    expect(rawValueFromFetched(null, "string")).toBe("");
  });
});

describe("collectUpstreamNodeIds", () => {
  it("walks predecessors from a node", () => {
    const edges = [edge("A", "B"), edge("B", "C")];
    expect(collectUpstreamNodeIds(edges, "C")).toEqual(["C", "B", "A"]);
  });
  it("terminates on a cycle", () => {
    const edges = [edge("A", "B"), edge("B", "A")];
    expect(collectUpstreamNodeIds(edges, "A")).toEqual(["A", "B"]);
  });
});

describe("groupAvailableVariables", () => {
  it("splits into process/form groups, omitting empties", () => {
    const vars: AvailableVariable[] = [
      { name: "g", ref: "g", type: "string", origin: "global" },
      { name: "t", ref: "r", type: "string", origin: "task" },
    ];
    expect(groupAvailableVariables(vars)).toEqual([
      { key: "process", variables: [vars[0]] },
      { key: "form", variables: [vars[1]] },
    ]);
    expect(groupAvailableVariables([vars[0]])).toEqual([
      { key: "process", variables: [vars[0]] },
    ]);
  });
});

describe("availableVariablesAt", () => {
  it("returns globals first, then upstream task variables", () => {
    const nodes = [taskNode("s", "Start"), taskNode("t1", "T1"), taskNode("t2", "T2")];
    const edges = [edge("s", "t1"), edge("t1", "t2")];
    const savedActorForms: Record<string, SavedActorForm> = {
      t1: { actorLabel: "T1", schema: formWith("a", "f1") },
    };
    const result = availableVariablesAt({
      nodes,
      edges,
      savedActorForms,
      globals: [{ name: "g", type: "string" }],
      nodeId: "t2",
    });
    expect(result).toEqual([
      { name: "g", ref: "g", type: "string", origin: "global" },
      { name: "a", ref: "f1", type: "string", origin: "task", source: "T1" },
    ]);
  });

  it("excludes the node's own form when excludeSelf is set", () => {
    const nodes = [taskNode("t1", "T1")];
    const savedActorForms: Record<string, SavedActorForm> = {
      t1: { actorLabel: "T1", schema: formWith("a", "f1") },
    };
    const result = availableVariablesAt({
      nodes,
      edges: [],
      savedActorForms,
      globals: [],
      nodeId: "t1",
      excludeSelf: true,
    });
    expect(result).toEqual([]);
  });
});
