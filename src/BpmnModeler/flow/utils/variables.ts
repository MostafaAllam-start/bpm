import { isFormSchema } from "../../../forms/types.ts";
import type { FieldType, FormSchema } from "../../../forms/types.ts";
import type { SavedActorForm } from "../../types.ts";
import type {
  BpmnEdge,
  BpmnNode,
  GlobalVariable,
  GlobalVariableType,
} from "../types/index.ts";

// Process variables and the "what's in scope here" computation, shared by the
// XML serializer (which declares every form's variables on the process) and the
// properties panel (which offers them as condition-expression suggestions).

// A process variable derived from one form field.
export type ProcessVariable = {
  name: string;
  type: string;
  required: boolean;
  fieldId?: string;
  sourceTask: string;
  sourceActor?: string;
};

// Field types that render content but capture no answer — they produce no
// variable.
const DISPLAY_ONLY: ReadonlySet<FieldType> = new Set(["html", "image", "iframe"]);

// Map a form field type onto the coarse variable type we expose.
export function variableTypeOf(type: FieldType): string {
  switch (type) {
    case "number":
    case "rating":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
    case "datetime":
      return "date";
    case "checkbox":
      return "array";
    case "fileupload":
    case "imageupload":
      return "file";
    case "signature":
    case "signatureupload":
      return "signature";
    default:
      return "string";
  }
}

// Every variable a single form contributes (one per answerable field).
export function variablesFromForm(
  schema: FormSchema,
  sourceTask: string,
  sourceActor?: string,
): ProcessVariable[] {
  const out: ProcessVariable[] = [];
  for (const page of schema.pages ?? []) {
    for (const field of page.elements ?? []) {
      if (!field?.name || DISPLAY_ONLY.has(field.type)) continue;
      out.push({
        name: field.name,
        type: variableTypeOf(field.type),
        required: Boolean(field.isRequired),
        fieldId: field.id,
        sourceTask,
        sourceActor,
      });
    }
  }
  return out;
}

// Coerce a raw string (a variable default, or a value typed into the run-time
// prompt) into the typed runtime value its declared type implies, so it
// compares correctly in condition expressions.
export function coerceVariableValue(type: GlobalVariableType, raw: string): unknown {
  const value = raw.trim();
  switch (type) {
    case "number":
      return value === "" || Number.isNaN(Number(value)) ? value : Number(value);
    case "boolean":
      return value === "true";
    case "array":
      return value === "" ? [] : value.split(",").map((s) => s.trim()).filter(Boolean);
    default:
      return value;
  }
}

// The starting variable store for a run: every named global with its (typed)
// default value.
export function seedVariables(globals: GlobalVariable[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const variable of globals) {
    const name = variable.name.trim();
    if (name) out[name] = coerceVariableValue(variable.type, variable.defaultValue ?? "");
  }
  return out;
}

// Node ids reachable by walking the sequence flows backwards from `fromId`
// (its transitive predecessors), including `fromId` itself. These are the
// elements that can execute before a flow leaving `fromId` is evaluated, so
// their produced variables are in scope for that flow's condition. Visited-set
// guarded, so loops in the graph terminate.
export function collectUpstreamNodeIds(edges: BpmnEdge[], fromId: string): string[] {
  const predecessors = new Map<string, string[]>();
  for (const edge of edges) {
    const list = predecessors.get(edge.target);
    if (list) list.push(edge.source);
    else predecessors.set(edge.target, [edge.source]);
  }
  const ordered: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const pred of predecessors.get(current) ?? []) {
      if (visited.has(pred)) continue;
      visited.add(pred);
      ordered.push(pred);
      queue.push(pred);
    }
  }
  return ordered;
}

// A variable offered as a condition-expression suggestion: its name, coarse
// type and where it comes from (a process-global declaration, or the upstream
// task whose form produces it).
export type AvailableVariable = {
  name: string;
  type: string;
  origin: "global" | "task";
  // For task variables: the producing task's label (for the tooltip).
  source?: string;
};

// In-scope variables grouped by category for the condition builder. `key` is an
// i18n suffix under `props.varCategory.*`. Ordered process-first, then form;
// empty categories are omitted. Easy to extend with further origins later.
export type AvailableVariableGroup = {
  key: "process" | "form";
  variables: AvailableVariable[];
};

export function groupAvailableVariables(
  variables: AvailableVariable[],
): AvailableVariableGroup[] {
  const process = variables.filter((v) => v.origin === "global");
  const form = variables.filter((v) => v.origin === "task");
  const groups: AvailableVariableGroup[] = [];
  if (process.length) groups.push({ key: "process", variables: process });
  if (form.length) groups.push({ key: "form", variables: form });
  return groups;
}

// The variables in scope at `nodeId`: the process globals plus the variables
// produced by every upstream task's form. Deduped by name (globals win, then
// nearer tasks), so each name is offered once.
export function availableVariablesAt(opts: {
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  savedActorForms: Record<string, SavedActorForm>;
  globals: GlobalVariable[];
  nodeId: string;
}): AvailableVariable[] {
  const { nodes, edges, savedActorForms, globals, nodeId } = opts;
  const out: AvailableVariable[] = [];
  const seen = new Set<string>();

  for (const variable of globals) {
    const name = variable.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, type: variable.type, origin: "global" });
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const id of collectUpstreamNodeIds(edges, nodeId)) {
    const node = nodeById.get(id);
    const saved = savedActorForms[id];
    if (!node || !saved || !isFormSchema(saved.schema)) continue;
    const label = saved.actorLabel || node.data.name || id;
    for (const variable of variablesFromForm(saved.schema, id, label)) {
      if (seen.has(variable.name)) continue;
      seen.add(variable.name);
      out.push({ name: variable.name, type: variable.type, origin: "task", source: label });
    }
  }
  return out;
}
