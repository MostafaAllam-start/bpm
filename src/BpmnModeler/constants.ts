// A minimal but valid BPMN 2.0 diagram to start from. It contains a single
// start event so the canvas isn't empty — drag from its context pad (or the
// palette on the left) to model the rest of the process.
export const INITIAL_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

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

export const ACTOR_KIND_LABELS: Record<ActorKind, string> = {
  orgtype: "Org type",
  orgunit: "Org unit",
  group: "Group",
  role: "Role",
  employee: "Employee",
  // Free-text actor: the user types a value instead of picking an entity, and
  // that text (not an id) is what gets persisted.
  custom: "Custom",
};

// A "role" actor is either an employee (pick a person) or a manager (pick an
// org unit, then one of its managers).
export const ACTOR_ROLES = ["employee", "manager"] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export const ACTOR_ROLE_LABELS: Record<ActorRole, string> = {
  employee: "Employee",
  manager: "Manager",
};

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
