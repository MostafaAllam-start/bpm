import { useEffect } from "react";

import { validateWorkflow } from "../services/validation.ts";
import type { VariableCheck } from "../services/validation.ts";
import { useApiCheckStore } from "../store/apiCheckStore.ts";
import { useValidationStore } from "../store/validationStore.ts";
import type { BpmnEdge, BpmnNode, GlobalVariable } from "../types/index.ts";

// Recomputes validation whenever the graph settles and publishes the result to
// the validation store, where the node badges and the validation panel read it.
// Also factors in process variables: "manual" variables need a design-time
// value, and "api" variables need a complete endpoint plus a successful
// connection test (tracked in the api-check store).
export function useValidation(
  nodes: BpmnNode[],
  edges: BpmnEdge[],
  variables: GlobalVariable[],
): void {
  const setResult = useValidationStore((s) => s.setResult);
  const apiStatus = useApiCheckStore((s) => s.status);
  useEffect(() => {
    const checks: VariableCheck[] = variables
      .filter((v) => v.name.trim())
      .map((v) => {
        const name = v.name.trim();
        return {
          name,
          source: v.source ?? "manual",
          hasValue: Boolean(v.value?.trim()),
          hasConfig: Boolean(v.api?.url?.trim()),
          apiStatus: apiStatus[name] ?? "untested",
        };
      });
    const id = setTimeout(() => setResult(validateWorkflow(nodes, edges, checks)), 200);
    return () => clearTimeout(id);
  }, [nodes, edges, variables, apiStatus, setResult]);
}
