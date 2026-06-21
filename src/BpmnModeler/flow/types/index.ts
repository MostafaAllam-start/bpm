import type { Node, Edge } from "@xyflow/react";

// The React Flow re-implementation of the BPMN modeler keeps the diagram as a
// plain JSON graph (nodes + edges) instead of a bpmn-js moddle tree. This file
// defines that model and the registry of BPMN element types it understands.
//
// Each diagram element is one of a fixed set of BPMN element types. We keep the
// BPMN local-name (lowerCamel, e.g. "startEvent") as the canonical key — it maps
// directly to the BPMN 2.0 XML tag and back — and group the keys into three
// visual categories (event / task / gateway) that drive which React Flow node
// component renders them.

export type BpmnCategory = "event" | "task" | "gateway";

// Every BPMN element type the editor can create. The string value is the BPMN
// XML local name (so `bpmn:` + key is the tag), and also the React Flow node
// `type` is the category, with the specific type carried in `data.bpmnType`.
export type BpmnElementType =
  | "startEvent"
  | "endEvent"
  | "intermediateThrowEvent"
  | "intermediateCatchEvent"
  | "task"
  | "userTask"
  | "serviceTask"
  | "manualTask"
  | "scriptTask"
  | "sendTask"
  | "receiveTask"
  | "businessRuleTask"
  | "exclusiveGateway"
  | "parallelGateway"
  | "inclusiveGateway"
  | "eventBasedGateway";

export type ElementSpec = {
  category: BpmnCategory;
  // Default size (px) used when a shape has no BPMNDI bounds (new nodes).
  width: number;
  height: number;
  // i18n key (in the `bpmn` namespace) for the palette label.
  labelKey: string;
  // Whether this type can carry an actor assignment + attached form.
  actor: boolean;
};

// Canonical sizes match bpmn-js defaults so imported BPMNDI bounds line up.
const EVENT = 36;
const GATEWAY = 50;
const TASK_W = 100;
const TASK_H = 80;

export const ELEMENT_SPECS: Record<BpmnElementType, ElementSpec> = {
  // The start event carries the process's *initial* actor + form: the actor who
  // begins the process and the form shown to them first when a run starts.
  startEvent: { category: "event", width: EVENT, height: EVENT, labelKey: "palette.startEvent", actor: true },
  endEvent: { category: "event", width: EVENT, height: EVENT, labelKey: "palette.endEvent", actor: false },
  intermediateThrowEvent: { category: "event", width: EVENT, height: EVENT, labelKey: "palette.intermediateThrowEvent", actor: false },
  intermediateCatchEvent: { category: "event", width: EVENT, height: EVENT, labelKey: "palette.intermediateCatchEvent", actor: false },
  task: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.task", actor: true },
  userTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.userTask", actor: true },
  serviceTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.serviceTask", actor: true },
  manualTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.manualTask", actor: true },
  scriptTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.scriptTask", actor: true },
  sendTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.sendTask", actor: true },
  receiveTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.receiveTask", actor: true },
  businessRuleTask: { category: "task", width: TASK_W, height: TASK_H, labelKey: "palette.businessRuleTask", actor: true },
  exclusiveGateway: { category: "gateway", width: GATEWAY, height: GATEWAY, labelKey: "palette.exclusiveGateway", actor: false },
  parallelGateway: { category: "gateway", width: GATEWAY, height: GATEWAY, labelKey: "palette.parallelGateway", actor: false },
  inclusiveGateway: { category: "gateway", width: GATEWAY, height: GATEWAY, labelKey: "palette.inclusiveGateway", actor: false },
  eventBasedGateway: { category: "gateway", width: GATEWAY, height: GATEWAY, labelKey: "palette.eventBasedGateway", actor: false },
};

// The `data` payload carried by every diagram node.
export type BpmnNodeData = {
  bpmnType: BpmnElementType;
  // The element's display label (BPMN `name` attribute).
  name: string;
  // Flat custom attributes that round-trip to XML under our `ecmplus`
  // namespace: the actor assignment (actorKind, actorPrimaryId, …) and the
  // business metadata fields (owner, priority, sla, category, importance,
  // notes). Bare attribute names → string values.
  props: Record<string, string>;
  // Optional fill / stroke colours (written to BPMNDI on export).
  fill?: string;
  stroke?: string;
  // React Flow's Node<T> requires the data to be an index signature record.
  [key: string]: unknown;
};

// The `data` payload carried by every sequence-flow edge.
export type BpmnEdgeData = {
  // Visible label on the arrow (BPMN `name`). Shown in place of the condition
  // expression; when empty, the raw condition is shown on the canvas instead.
  name?: string;
  // FEEL/expression body of the flow's bpmn:conditionExpression.
  conditionExpression?: string;
  // Whether this is the gateway's default flow (rendered with a slash marker).
  isDefault?: boolean;
  props?: Record<string, string>;
  [key: string]: unknown;
};

export type BpmnNode = Node<BpmnNodeData>;
export type BpmnEdge = Edge<BpmnEdgeData>;

// The value types a process-global variable can hold. Single source of truth:
// the panel builds its type dropdown from this list and the XML parser
// validates against it.
export const GLOBAL_VARIABLE_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
] as const;
export type GlobalVariableType = (typeof GLOBAL_VARIABLE_TYPES)[number];

// How a process-global variable gets its value:
// - "manual": a fixed value authored at design time (required — the process is
//   invalid without it).
// - "api": fetched from a configured endpoint at process creation.
// - "actor": supplied by the initial actor at process creation; may carry an
//   optional default the actor sees pre-filled.
export type VariableValueSource = "manual" | "api" | "actor";

// Fetch configuration for an `api`-sourced variable. `url` is the GET endpoint;
// `path` is a dot-path into the JSON response that locates the value (or, for a
// list/array variable, the array itself); `key` applies only to list variables
// — the field plucked from each item of that array to build the list.
export type VariableApiSource = {
  url: string;
  path: string;
  key?: string;
};

// A user-declared, process-global variable — authored directly in the process
// properties (unlike the form-derived variables, which are computed from each
// task's form on export). Its value is not authored at design time; it is
// supplied at process creation, either manually or by fetching from the
// configured API. Unique by `name` within a process; round-trips through the
// BPMN XML as an `ecmplus:globalVariable` extension element.
export type GlobalVariable = {
  name: string;
  type: GlobalVariableType;
  // Value source. Defaults to "manual".
  source?: VariableValueSource;
  // For "manual": the fixed design-time value (required).
  // For "actor": an optional default pre-filled at process creation.
  // Unused for "api".
  value?: string;
  // Present (and meaningful) only when `source` is "api".
  api?: VariableApiSource;
};

// One actor permitted to act on the process — an entry in the process-level
// "allowed actors" list. `label` is the human-readable display name; `props`
// holds the same flat actor* attributes a task assignment produces (actorKind /
// actorPrimaryId / actorEmployeeId / …), so the same cascading selector and
// serialisation logic can be reused. `id` is a client-side React key only and is
// never written to the BPMN XML.
export type AllowedActor = {
  id: string;
  label: string;
  props: Record<string, string>;
};

// A whole diagram: the process metadata plus its nodes and edges.
export type FlowDiagram = {
  processId: string;
  processName: string;
  isExecutable: boolean;
  // ecmplus business props declared on the process root itself.
  processProps: Record<string, string>;
  // User-declared process-global variables (unique by name).
  processVariables: GlobalVariable[];
  // Actors (users, org units, groups, managers, …) permitted to act on the
  // process as a whole. Round-trips as `ecmplus:allowedActor` extension elements.
  allowedActors: AllowedActor[];
  nodes: BpmnNode[];
  edges: BpmnEdge[];
};

// The BPMN element types we treat as "actors" (can carry an assignment + form).
export function isActorType(type: BpmnElementType): boolean {
  return ELEMENT_SPECS[type].category === "task";
}

// The React Flow node `type` for a BPMN element — its visual category, which
// selects the rendering component registered in `nodeTypes`.
export function categoryOf(type: BpmnElementType): BpmnCategory {
  return ELEMENT_SPECS[type].category;
}
