import type { ActorKind, ActorRole } from "./constants.ts";
import type { Group } from "./api/types.ts";

// A form schema the user designed for a given actor, keyed by actor id in the
// `savedActorForms` map.
export type SavedActorForm = {
  actorLabel: string;
  schema: object;
};

export type BpmnEditorProps = {
  savedActorForms?: Record<string, SavedActorForm>;
  onOpenActorForm?: (actorId: string, actorLabel: string) => void;
};

// Right-click menu anchored at a screen position over an actor element.
export type ContextMenuState = {
  x: number;
  y: number;
  actorId: string;
  actorLabel: string;
};

// A single option rendered by the select components. `id` matches the backing
// entity id; `label` is what the user sees; `sublabel`/`image` are optional
// adornments (e.g. an employee's org-unit path and avatar).
export type SelectOption = {
  id: number | string;
  label: string;
  sublabel?: string;
  image?: string | null;
};

// In-progress state of the actor selector. Only the slots relevant to the
// chosen `kind` (and, for "role", the chosen `role`) are populated.
export type ActorSelectorState = {
  actorId: string;
  // Free-text display name the user gives this actor. When set it becomes the
  // element's `name`; otherwise a label is derived from the selection.
  name: string;
  kind: ActorKind;
  orgType: SelectOption | null;
  orgUnit: SelectOption | null;
  group: SelectOption | null;
  role: ActorRole;
  employee: SelectOption | null;
  manager: SelectOption | null;
  // Free-text value for the "custom" kind (persisted as-is, no id lookup).
  customValue: string;
};

// The setters ActorFilters uses to drive the selector. Grouped into one object
// so the modal can forward them without a long prop list.
export type ActorControls = {
  setName: (name: string) => void;
  setKind: (kind: ActorKind) => void;
  setOrgType: (option: SelectOption | null) => void;
  setOrgUnit: (option: SelectOption | null) => void;
  selectGroup: (group: Group | null) => void;
  setRole: (role: ActorRole) => void;
  setEmployee: (option: SelectOption | null) => void;
  setManager: (option: SelectOption | null) => void;
  setCustomValue: (value: string) => void;
};
