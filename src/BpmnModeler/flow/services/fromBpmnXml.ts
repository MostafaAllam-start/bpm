import { ELEMENT_SPECS, GLOBAL_VARIABLE_TYPES } from "../types/index.ts";
import type {
  AllowedActor,
  BpmnEdge,
  BpmnElementType,
  BpmnNode,
  BpmnNodeData,
  FlowDiagram,
  GlobalVariable,
  GlobalVariableType,
} from "../types/index.ts";

// Parse a BPMN 2.0 XML document into our React Flow graph model. The inverse of
// `toBpmnXml`. It reads the process's flow elements (events / tasks / gateways)
// as nodes, its sequence flows as edges, the BPMNDI plane for positions, sizes
// and colours, and our `ecmplus:*` custom attributes for the actor assignment
// and business metadata.
//
// Anything it doesn't recognise (an exotic element type, a pool/lane) is skipped
// rather than failing, so a partially-supported file still loads what it can.

const BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";
const ECMPLUS_NS = "http://ecmplus.com/schema/bpmn/1.0";

// BPMN local names we render, keyed for O(1) lookup. Matches `BpmnElementType`.
const SUPPORTED = new Set<string>(Object.keys(ELEMENT_SPECS));

// Throwable parse error carrying a human-readable message.
export class BpmnParseError extends Error {}

function firstByLocalName(root: ParentNode, name: string): Element | null {
  return root.querySelector(`*|${cssEscape(name)}`) ?? legacyFind(root, name);
}

// querySelector with a namespace wildcard isn't universally reliable across the
// odd prefix, so fall back to a manual descendant scan by localName.
function legacyFind(root: ParentNode, name: string): Element | null {
  const all = (root as Element | Document).getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].localName === name) return all[i];
  }
  return null;
}

function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

// Direct + nested element children of `parent` with the given local name.
function descendantsByLocalName(parent: Element, name: string): Element[] {
  const out: Element[] = [];
  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].localName === name) out.push(all[i]);
  }
  return out;
}

// Read every `ecmplus:*` attribute (and legacy bare actor* attributes) off an
// element into a flat bare-name → value map.
function readEcmProps(el: Element): Record<string, string> {
  const props: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i += 1) {
    const attr = el.attributes[i];
    if (attr.namespaceURI === ECMPLUS_NS || attr.name.startsWith("ecmplus:")) {
      props[attr.localName] = attr.value;
    } else if (attr.name.startsWith("actor")) {
      // Backward-compat: actor props once written as plain attributes.
      props[attr.name] = attr.value;
    }
  }
  return props;
}

// Read the process's user-authored global variables from its extension
// elements (`ecmplus:globalVariable`), deduped by name and with the type
// validated against the known set (unknown types fall back to "string").
function readGlobalVariables(process: Element): GlobalVariable[] {
  const known = GLOBAL_VARIABLE_TYPES as readonly string[];
  const seen = new Set<string>();
  const out: GlobalVariable[] = [];
  for (const el of descendantsByLocalName(process, "globalVariable")) {
    const name = el.getAttribute("name")?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const rawType = el.getAttribute("type") ?? "";
    const type = (known.includes(rawType) ? rawType : "string") as GlobalVariableType;
    const rawSource = el.getAttribute("source");
    const source = rawSource === "api" || rawSource === "actor" ? rawSource : "manual";
    const variable: GlobalVariable = { name, type, source };
    if (source === "api") {
      variable.api = {
        url: el.getAttribute("apiUrl") || "",
        path: el.getAttribute("apiPath") || "",
        key: el.getAttribute("apiItemKey") || undefined,
      };
    } else {
      // "manual" fixed value / "actor" optional default.
      const value = el.getAttribute("value");
      if (value) variable.value = value;
    }
    out.push(variable);
  }
  return out;
}

// Read the process-level "allowed actors" list from its extension elements
// (`ecmplus:allowedActor`). Each element carries a `label` plus the flat actor*
// attributes the selector produced; everything but `label` becomes the entry's
// `props`. Entries without an `actorKind` are skipped as malformed.
function readAllowedActors(process: Element): AllowedActor[] {
  const out: AllowedActor[] = [];
  for (const el of descendantsByLocalName(process, "allowedActor")) {
    const props: Record<string, string> = {};
    let label = "";
    for (let i = 0; i < el.attributes.length; i += 1) {
      const attr = el.attributes[i];
      if (attr.localName === "label") label = attr.value;
      else props[attr.localName] = attr.value;
    }
    if (!props.actorKind) continue;
    out.push({
      id: `allowedActor_${out.length}`,
      label: label || props.actorPrimaryName || props.actorEmployeeName || "",
      props,
    });
  }
  return out;
}

type Bounds = { x: number; y: number; width: number; height: number };
type ShapeDi = Bounds & { fill?: string; stroke?: string };

// Index the BPMNDI plane: element id → its shape bounds + colours.
function indexShapes(definitions: Element): Map<string, ShapeDi> {
  const map = new Map<string, ShapeDi>();
  for (const shape of descendantsByLocalName(definitions, "BPMNShape")) {
    const ref = shape.getAttribute("bpmnElement");
    if (!ref) continue;
    const bounds = shape.getElementsByTagName("*");
    let b: Bounds | null = null;
    for (let i = 0; i < bounds.length; i += 1) {
      if (bounds[i].localName === "Bounds") {
        b = {
          x: Number(bounds[i].getAttribute("x") ?? 0),
          y: Number(bounds[i].getAttribute("y") ?? 0),
          width: Number(bounds[i].getAttribute("width") ?? 0),
          height: Number(bounds[i].getAttribute("height") ?? 0),
        };
        break;
      }
    }
    if (!b) continue;
    map.set(ref, {
      ...b,
      fill: shape.getAttributeNS(null, "fill") || shape.getAttribute("bioc:fill") || undefined,
      stroke: shape.getAttributeNS(null, "stroke") || shape.getAttribute("bioc:stroke") || undefined,
    });
  }
  return map;
}

export function fromBpmnXml(xml: string): FlowDiagram {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new BpmnParseError(parseError.textContent || "Invalid BPMN XML");
  }

  const definitions = doc.documentElement;
  if (!definitions || definitions.localName !== "definitions") {
    throw new BpmnParseError("Not a BPMN document (missing <definitions>)");
  }

  const process = firstByLocalName(definitions, "process");
  if (!process) {
    throw new BpmnParseError("No <process> found in the BPMN document");
  }

  const shapes = indexShapes(definitions);
  const nodes: BpmnNode[] = [];
  const edges: BpmnEdge[] = [];

  // Default flow refs, gathered so we can mark those edges after building them.
  const defaultFlowIds = new Set<string>();

  // Walk the process's direct children. Sequence flows are handled separately.
  for (const child of Array.from(process.children)) {
    if (child.namespaceURI && child.namespaceURI !== BPMN_NS) continue;
    const local = child.localName;

    if (local === "sequenceFlow") continue; // handled below

    if (SUPPORTED.has(local)) {
      const type = local as BpmnElementType;
      const id = child.getAttribute("id") || `${local}_${nodes.length}`;
      const di = shapes.get(id);
      const spec = ELEMENT_SPECS[type];

      const data: BpmnNodeData = {
        bpmnType: type,
        name: child.getAttribute("name") ?? "",
        props: readEcmProps(child),
        fill: di?.fill,
        stroke: di?.stroke,
      };

      nodes.push({
        id,
        type: spec.category,
        position: { x: di?.x ?? 100, y: di?.y ?? 100 },
        width: di?.width || spec.width,
        // Tasks auto-grow to fit their content, so the imported height is only a
        // seed (React Flow re-measures); fixed-size shapes keep it as-is.
        ...(spec.category === "task"
          ? { initialHeight: di?.height || spec.height }
          : { height: di?.height || spec.height }),
        data,
      });

      const def = child.getAttribute("default");
      if (def) defaultFlowIds.add(def);
    }
  }

  // Sequence flows → edges.
  for (const flow of descendantsByLocalName(process, "sequenceFlow")) {
    const id = flow.getAttribute("id") || `Flow_${edges.length}`;
    const source = flow.getAttribute("sourceRef");
    const target = flow.getAttribute("targetRef");
    if (!source || !target) continue;

    let condition: string | undefined;
    for (const cond of descendantsByLocalName(flow, "conditionExpression")) {
      condition = cond.textContent?.trim() || undefined;
      break;
    }

    edges.push({
      id,
      source,
      target,
      type: "sequenceFlow",
      data: {
        name: flow.getAttribute("name") ?? undefined,
        conditionExpression: condition,
        isDefault: defaultFlowIds.has(id),
        props: readEcmProps(flow),
      },
    });
  }

  return {
    processId: process.getAttribute("id") || "Process_1",
    processName: process.getAttribute("name") ?? "",
    isExecutable: process.getAttribute("isExecutable") === "true",
    processProps: readEcmProps(process),
    processVariables: readGlobalVariables(process),
    allowedActors: readAllowedActors(process),
    nodes,
    edges,
  };
}
