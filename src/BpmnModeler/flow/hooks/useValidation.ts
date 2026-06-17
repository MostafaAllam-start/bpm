import { useEffect } from "react";

import { validateWorkflow } from "../services/validation.ts";
import { useValidationStore } from "../store/validationStore.ts";
import type { BpmnEdge, BpmnNode } from "../types/index.ts";

// Recomputes validation whenever the graph settles and publishes the result to
// the validation store, where the node badges and the validation panel read it.
export function useValidation(nodes: BpmnNode[], edges: BpmnEdge[]): void {
  const setResult = useValidationStore((s) => s.setResult);
  useEffect(() => {
    const id = setTimeout(() => setResult(validateWorkflow(nodes, edges)), 200);
    return () => clearTimeout(id);
  }, [nodes, edges, setResult]);
}
