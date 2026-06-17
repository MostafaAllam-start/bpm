import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnNode, FlowDiagram } from "../types/index.ts";
import { isFormSchema } from "../../../forms/types.ts";
import type { FormSchema } from "../../../forms/types.ts";
import type { BpmnEditorProps } from "../../types.ts";
import { variablesFromForm } from "../utils/variables.ts";
import type { ProcessVariable } from "../utils/variables.ts";

// Serialize our React Flow graph model back into BPMN 2.0 XML — the inverse of
// `fromBpmnXml`. It writes the process (flow elements + sequence flows), a
// BPMNDI plane laying out every shape and edge, our `ecmplus:*` custom
// attributes, and (when forms are supplied) the embedded form definitions plus
// the process-level variable declarations they imply.
//
// Returns the XML string and the flat list of declared process variables (the
// same data the old `embedFormsAndVariables` returned, for the details JSON).

// Re-exported for callers that consume the serializer's `variables` output.
export type { ProcessVariable };

// XML escaping for attribute values and text content.
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render a flat bare-name → value map as `ecmplus:name="value"` attributes.
function ecmAttrs(props: Record<string, string> | undefined): string {
  if (!props) return "";
  return Object.entries(props)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => ` ecmplus:${k}="${esc(String(v))}"`)
    .join("");
}

// Center point of a node, used as the simple waypoint for DI edges.
function center(node: BpmnNode): { x: number; y: number } {
  const w = (node.width as number) || ELEMENT_SPECS[node.data.bpmnType].width;
  // Tasks auto-size, so their height lives on `measured`, not `height`.
  const h =
    (node.height as number) ||
    (node.measured?.height as number) ||
    ELEMENT_SPECS[node.data.bpmnType].height;
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 };
}

type ToBpmnOptions = {
  savedActorForms?: BpmnEditorProps["savedActorForms"];
};

export function toBpmnXml(
  diagram: FlowDiagram,
  { savedActorForms = {} }: ToBpmnOptions = {},
): { xml: string; variables: ProcessVariable[] } {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const variables: ProcessVariable[] = [];

  // Build incoming/outgoing flow id lists per node (BPMN requires them).
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  for (const edge of diagram.edges) {
    push(outgoing, edge.source, edge.id);
    push(incoming, edge.target, edge.id);
  }

  // The flow id each gateway/task marks as its default, if any.
  const defaultByNode = new Map<string, string>();
  for (const edge of diagram.edges) {
    if (edge.data?.isDefault) defaultByNode.set(edge.source, edge.id);
  }

  // ---- Process flow elements -------------------------------------------------
  const flowEls: string[] = [];
  for (const node of diagram.nodes) {
    const tag = `bpmn:${node.data.bpmnType}`;
    const attrs: string[] = [`id="${esc(node.id)}"`];
    if (node.data.name) attrs.push(`name="${esc(node.data.name)}"`);
    const def = defaultByNode.get(node.id);
    if (def) attrs.push(`default="${esc(def)}"`);

    const ecm = ecmAttrs(node.data.props);

    // Embedded form (only for actor elements with a saved form).
    const saved = savedActorForms[node.id];
    const hasForm =
      ELEMENT_SPECS[node.data.bpmnType].actor &&
      saved &&
      isFormSchema(saved.schema);

    const inFlows = (incoming.get(node.id) ?? []).map((f) => `      <bpmn:incoming>${esc(f)}</bpmn:incoming>`);
    const outFlows = (outgoing.get(node.id) ?? []).map((f) => `      <bpmn:outgoing>${esc(f)}</bpmn:outgoing>`);

    const inner: string[] = [];
    if (hasForm) {
      inner.push(
        `      <bpmn:extensionElements>`,
        `        <ecmplus:formDefinition actorId="${esc(node.id)}" actorLabel="${esc(saved!.actorLabel)}">${esc(JSON.stringify(saved!.schema))}</ecmplus:formDefinition>`,
        `      </bpmn:extensionElements>`,
      );
      variables.push(
        ...variablesFromForm(saved!.schema as FormSchema, node.id, saved!.actorLabel),
      );
    }
    inner.push(...inFlows, ...outFlows);

    if (inner.length) {
      flowEls.push(`    <${tag} ${attrs.join(" ")}${ecm}>`);
      flowEls.push(...inner);
      flowEls.push(`    </${tag}>`);
    } else {
      flowEls.push(`    <${tag} ${attrs.join(" ")}${ecm} />`);
    }
  }

  // ---- Sequence flows --------------------------------------------------------
  for (const edge of diagram.edges) {
    const attrs = [
      `id="${esc(edge.id)}"`,
      `sourceRef="${esc(edge.source)}"`,
      `targetRef="${esc(edge.target)}"`,
    ];
    if (edge.data?.name) attrs.push(`name="${esc(edge.data.name)}"`);
    const ecm = ecmAttrs(edge.data?.props);
    const condition = edge.data?.conditionExpression?.trim();
    if (condition) {
      flowEls.push(`    <bpmn:sequenceFlow ${attrs.join(" ")}${ecm}>`);
      flowEls.push(
        `      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${esc(condition)}</bpmn:conditionExpression>`,
      );
      flowEls.push(`    </bpmn:sequenceFlow>`);
    } else {
      flowEls.push(`    <bpmn:sequenceFlow ${attrs.join(" ")}${ecm} />`);
    }
  }

  // ---- Process-level variable declarations -----------------------------------
  // BPMN allows a single <extensionElements> per element, so both the
  // form-derived variables and the user-authored global variables share one.
  const extInner: string[] = [];

  if (variables.length) {
    const vars = variables
      .map((v) => {
        const a = [
          `name="${esc(v.name)}"`,
          `type="${esc(v.type)}"`,
          `required="${v.required}"`,
        ];
        if (v.fieldId) a.push(`fieldId="${esc(v.fieldId)}"`);
        a.push(`sourceTask="${esc(v.sourceTask)}"`);
        if (v.sourceActor) a.push(`sourceActor="${esc(v.sourceActor)}"`);
        return `        <ecmplus:variable ${a.join(" ")} />`;
      })
      .join("\n");
    extInner.push(`      <ecmplus:variables>\n${vars}\n      </ecmplus:variables>`);
  }

  // User-authored global variables, deduped by name (first wins) so the
  // declaration stays unique even if the UI briefly held a clashing name.
  const seenGlobal = new Set<string>();
  const globalVars = (diagram.processVariables ?? []).filter((v) => {
    const name = v.name.trim();
    if (!name || seenGlobal.has(name)) return false;
    seenGlobal.add(name);
    return true;
  });
  if (globalVars.length) {
    const decls = globalVars
      .map((v) => {
        const a = [`name="${esc(v.name.trim())}"`, `type="${esc(v.type)}"`];
        if (v.defaultValue) a.push(`defaultValue="${esc(v.defaultValue)}"`);
        return `        <ecmplus:globalVariable ${a.join(" ")} />`;
      })
      .join("\n");
    extInner.push(`      <ecmplus:globalVariables>\n${decls}\n      </ecmplus:globalVariables>`);
  }

  const processExtensions = extInner.length
    ? `    <bpmn:extensionElements>\n${extInner.join("\n")}\n    </bpmn:extensionElements>\n`
    : "";

  // ---- BPMNDI plane ----------------------------------------------------------
  const diShapes = diagram.nodes
    .map((node) => {
      const w = (node.width as number) || ELEMENT_SPECS[node.data.bpmnType].width;
      const h =
        (node.height as number) ||
        (node.measured?.height as number) ||
        ELEMENT_SPECS[node.data.bpmnType].height;
      const color =
        (node.data.fill ? ` bioc:fill="${esc(node.data.fill)}"` : "") +
        (node.data.stroke ? ` bioc:stroke="${esc(node.data.stroke)}"` : "");
      return (
        `      <bpmndi:BPMNShape id="${esc(node.id)}_di" bpmnElement="${esc(node.id)}"${color}>\n` +
        `        <dc:Bounds x="${node.position.x}" y="${node.position.y}" width="${w}" height="${h}" />\n` +
        `      </bpmndi:BPMNShape>`
      );
    })
    .join("\n");

  const diEdges = diagram.edges
    .map((edge) => {
      const s = nodeById.get(edge.source);
      const t = nodeById.get(edge.target);
      if (!s || !t) return "";
      const a = center(s);
      const b = center(t);
      return (
        `      <bpmndi:BPMNEdge id="${esc(edge.id)}_di" bpmnElement="${esc(edge.id)}">\n` +
        `        <di:waypoint x="${Math.round(a.x)}" y="${Math.round(a.y)}" />\n` +
        `        <di:waypoint x="${Math.round(b.x)}" y="${Math.round(b.y)}" />\n` +
        `      </bpmndi:BPMNEdge>`
      );
    })
    .filter(Boolean)
    .join("\n");

  const processAttrs = [
    `id="${esc(diagram.processId)}"`,
    `isExecutable="${diagram.isExecutable}"`,
  ];
  if (diagram.processName) processAttrs.splice(1, 0, `name="${esc(diagram.processName)}"`);
  const processEcm = ecmAttrs(diagram.processProps);

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n` +
    `                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n` +
    `                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n` +
    `                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n` +
    `                  xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"\n` +
    `                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
    `                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"\n` +
    `                  id="Definitions_1"\n` +
    `                  targetNamespace="http://bpmn.io/schema/bpmn">\n` +
    `  <bpmn:process ${processAttrs.join(" ")}${processEcm}>\n` +
    processExtensions +
    flowEls.join("\n") + "\n" +
    `  </bpmn:process>\n` +
    `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n` +
    `    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${esc(diagram.processId)}">\n` +
    diShapes + (diShapes && diEdges ? "\n" : "") + diEdges + "\n" +
    `    </bpmndi:BPMNPlane>\n` +
    `  </bpmndi:BPMNDiagram>\n` +
    `</bpmn:definitions>`;

  return { xml, variables };
}
