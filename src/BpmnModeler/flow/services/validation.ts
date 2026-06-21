import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnEdge, BpmnNode } from "../types/index.ts";

// The workflow validation engine — a pure function over the graph, with no React
// or store dependency, so it's trivially testable and reusable. It encodes the
// structural rules a runnable BPMN process must satisfy and returns issues both
// as a flat list (for the validation panel) and indexed by node (for the
// on-node error badges).

export type Severity = "error" | "warning";

export type ValidationIssue = {
  id: string;
  severity: Severity;
  // i18n key under the `bpmn` namespace's `validation.*`.
  messageKey: string;
  params?: Record<string, string | number>;
  // The node the issue is attached to (omitted for whole-diagram issues).
  nodeId?: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  byNode: Record<string, ValidationIssue[]>;
  ok: boolean;
};

// One process variable's state, distilled for validation: its value source plus
// the bits each source needs checked — whether a manual value is present, and
// for API variables whether the endpoint is configured and its latest "test
// connection" outcome.
export type VariableCheck = {
  name: string;
  source: "manual" | "api" | "actor";
  // For "manual": whether a (non-empty) value was authored.
  hasValue: boolean;
  // For "api": whether the endpoint URL is set, and the test-connection result.
  hasConfig: boolean;
  apiStatus: "untested" | "checking" | "ok" | "error";
};

export function validateWorkflow(
  nodes: BpmnNode[],
  edges: BpmnEdge[],
  variableChecks: VariableCheck[] = [],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (issue: ValidationIssue) => issues.push(issue);

  // Per-variable rules. "manual" needs a design-time value; "api" needs a
  // complete endpoint and a successful connection test (an untested or failing
  // endpoint makes the process invalid until fixed and re-tested); "actor"
  // variables are supplied at creation, so nothing to validate here.
  for (const check of variableChecks) {
    if (check.source === "manual") {
      if (!check.hasValue) {
        add({ id: `var-manual-empty-${check.name}`, severity: "error", messageKey: "validation.varManualEmpty", params: { name: check.name } });
      }
    } else if (check.source === "api") {
      if (!check.hasConfig) {
        add({ id: `var-api-incomplete-${check.name}`, severity: "error", messageKey: "validation.varApiIncomplete", params: { name: check.name } });
      } else if (check.apiStatus === "error") {
        add({ id: `var-api-failed-${check.name}`, severity: "error", messageKey: "validation.varApiFailed", params: { name: check.name } });
      } else if (check.apiStatus !== "ok") {
        add({ id: `var-api-untested-${check.name}`, severity: "error", messageKey: "validation.varApiUntested", params: { name: check.name } });
      }
    }
  }

  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  const outAdj = new Map<string, string[]>();
  for (const node of nodes) {
    inDeg.set(node.id, 0);
    outDeg.set(node.id, 0);
    outAdj.set(node.id, []);
  }
  for (const edge of edges) {
    outDeg.set(edge.source, (outDeg.get(edge.source) ?? 0) + 1);
    inDeg.set(edge.target, (inDeg.get(edge.target) ?? 0) + 1);
    outAdj.get(edge.source)?.push(edge.target);
  }

  const starts = nodes.filter((n) => n.data.bpmnType === "startEvent");
  const ends = nodes.filter((n) => n.data.bpmnType === "endEvent");

  // Rule: exactly one start event.
  if (starts.length === 0) {
    add({ id: "no-start", severity: "error", messageKey: "validation.noStart" });
  } else if (starts.length > 1) {
    for (const s of starts) {
      add({ id: `multi-start-${s.id}`, severity: "error", messageKey: "validation.multipleStart", nodeId: s.id });
    }
  }

  // Rule: at least one end event.
  if (ends.length === 0) {
    add({ id: "no-end", severity: "error", messageKey: "validation.noEnd" });
  }

  // Reachability from the (first) start event.
  const reachable = new Set<string>();
  if (starts.length > 0) {
    const queue = [starts[0].id];
    reachable.add(starts[0].id);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of outAdj.get(current) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
  }

  for (const node of nodes) {
    const spec = ELEMENT_SPECS[node.data.bpmnType];
    const incoming = inDeg.get(node.id) ?? 0;
    const outgoing = outDeg.get(node.id) ?? 0;

    // Rule: no fully disconnected nodes.
    if (incoming === 0 && outgoing === 0) {
      add({ id: `disconnected-${node.id}`, severity: "error", messageKey: "validation.disconnected", nodeId: node.id });
      continue;
    }

    // Rule: every non-start node must be reachable from the start.
    if (starts.length > 0 && node.data.bpmnType !== "startEvent" && !reachable.has(node.id)) {
      add({ id: `unreachable-${node.id}`, severity: "error", messageKey: "validation.unreachable", nodeId: node.id });
    }

    // Per-category flow rules.
    if (node.data.bpmnType === "startEvent") {
      if (outgoing === 0) add({ id: `start-noout-${node.id}`, severity: "error", messageKey: "validation.startNoOut", nodeId: node.id });
    } else if (node.data.bpmnType === "endEvent") {
      if (incoming === 0) add({ id: `end-noin-${node.id}`, severity: "error", messageKey: "validation.endNoIn", nodeId: node.id });
    } else if (spec.category === "gateway") {
      // Rule: gateway outputs must have valid connections (in and out).
      if (incoming === 0 || outgoing === 0) {
        add({ id: `gateway-flow-${node.id}`, severity: "error", messageKey: "validation.gatewayMissingFlow", nodeId: node.id });
      } else if (outgoing < 2) {
        add({ id: `gateway-single-${node.id}`, severity: "warning", messageKey: "validation.gatewaySingleOut", nodeId: node.id });
      }
    } else if (spec.category === "task") {
      if (incoming === 0 || outgoing === 0) {
        add({ id: `task-flow-${node.id}`, severity: "error", messageKey: "validation.taskMissingFlow", nodeId: node.id });
      }
    }
  }

  const byNode: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    (byNode[issue.nodeId] ??= []).push(issue);
  }

  return { issues, byNode, ok: issues.every((i) => i.severity !== "error") };
}
