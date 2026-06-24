// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { DIAGRAM_EXAMPLES } from "./examples.ts";
import { fromBpmnXml } from "./flow/services/fromBpmnXml.ts";
import { validateWorkflow } from "./flow/services/validation.ts";

// The single-start / single-end rule applies to the built-in examples too: each
// must parse to exactly one start and one end event and carry no validation
// *errors* (gateway "single outgoing" warnings are fine). Runs in jsdom because
// fromBpmnXml uses DOMParser. Pins the example rewrites against regressions.
describe("built-in examples are single-start / single-end and error-free", () => {
  for (const example of DIAGRAM_EXAMPLES) {
    it(`${example.id} has one start, one end, and no validation errors`, () => {
      const diagram = fromBpmnXml(example.xml);
      const starts = diagram.nodes.filter((n) => n.data.bpmnType === "startEvent");
      const ends = diagram.nodes.filter((n) => n.data.bpmnType === "endEvent");
      expect(starts).toHaveLength(1);
      expect(ends).toHaveLength(1);

      const { issues } = validateWorkflow(diagram.nodes, diagram.edges);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toEqual([]);
    });
  }
});
