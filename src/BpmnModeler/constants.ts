// A minimal but valid BPMN 2.0 diagram to start from. It contains a single
// start event so the canvas isn't empty — drag from its context pad (or the
// palette on the left) to model the rest of the process. `{{start}}` is the
// start-event name, filled in (translated) by `buildInitialDiagram`.
const INITIAL_DIAGRAM_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="{{start}}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Build the starting diagram with a translated start-event label. The label is
// XML-escaped so a name with `&`, `<`, `>` or `"` can't break the document.
export function buildInitialDiagram(startLabel: string): string {
  const safeLabel = startLabel
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return INITIAL_DIAGRAM_TEMPLATE.replace("{{start}}", safeLabel);
}

// The actor "kinds" the user can assign to an element. Each drives a different
// cascade of dropdowns in the actor selector (see ActorFilters).
export const ACTOR_KINDS = [
  "orgtype",
  "orgunit",
  "group",
  "role",
  "employee",
  "custom",
] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];
// Display labels for the kinds/roles are translated in the UI (bpmn:kind.*,
// bpmn:roleOption.*); the free-text "custom" kind persists the typed value
// rather than an entity id.

// A "role" actor is either an employee (pick a person) or a manager (pick an
// org unit, then one of its managers).
export const ACTOR_ROLES = ["employee", "manager"] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

// For the "custom" actor kind: where its value comes from. The actor can be
// resolved at run time from a process variable or a variable produced by an
// upstream form, or simply typed as free text. For variable sources the typed/
// selected value is the variable's name, resolved when the process runs.
export const ACTOR_CUSTOM_SOURCES = ["text", "process", "form"] as const;

export type ActorCustomSource = (typeof ACTOR_CUSTOM_SOURCES)[number];

// How many list rows to request per page from the searchable endpoints.
export const ACTOR_PAGE_SIZE = 25;

// The BPMN element types we treat as "actors" — the ones that can carry an
// actor assignment and an attached form.
export const ACTOR_ELEMENT_TYPES = new Set([
  "bpmn:Participant",
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ScriptTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
]);

export const BPMN_TYPE_LABELS: Record<string, string> = {
  "bpmn:Participant": "Participant",
  "bpmn:Task": "Task",
  "bpmn:UserTask": "User Task",
  "bpmn:ServiceTask": "Service Task",
  "bpmn:ManualTask": "Manual Task",
  "bpmn:ScriptTask": "Script Task",
  "bpmn:SendTask": "Send Task",
  "bpmn:ReceiveTask": "Receive Task",
};
