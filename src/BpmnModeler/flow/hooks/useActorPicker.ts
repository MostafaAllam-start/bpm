import { useState } from "react";

import type { ActorCustomSource, ActorKind, ActorRole } from "../../constants.ts";
import type { Group } from "../../api/types.ts";
import { buildActorAssignment } from "../../lib/actorAssignment.ts";
import type { ActorAssignment } from "../../lib/actorAssignment.ts";
import type { ActorControls, ActorSelectorState } from "../../types.ts";
import type { AvailableVariable } from "../utils/variables.ts";

// A blank selector state. `actorId` ties the selection to a diagram element for
// task assignment; the process-level "allowed actors" list passes "" because the
// selection isn't bound to any single element.
export function emptyActorState(actorId = ""): ActorSelectorState {
  return {
    actorId,
    name: "",
    kind: "orgunit",
    orgType: null,
    orgUnit: null,
    group: null,
    role: "employee",
    employee: null,
    manager: null,
    customSource: "text",
    customValue: "",
  };
}

// The cascading actor-selector state machine, shared by task assignment
// (`useFlowActorSelector`) and the process-level allowed-actors editor
// (`AllowedActors`). It owns the in-progress selection and exposes the `controls`
// that `ActorFilters` drives, plus `canSave`/`build` derived from
// `buildActorAssignment`. It is deliberately unaware of where the chosen actor
// ends up — the caller decides what to do with `build()`'s result on confirm.
export function useActorPicker() {
  const [selector, setSelector] = useState<ActorSelectorState | null>(null);
  // Variables in scope where the selector was opened, offered as the source for
  // a "custom" actor. Empty for contexts without a flow position.
  const [availableVariables, setAvailableVariables] = useState<
    AvailableVariable[]
  >([]);

  const controls: ActorControls = {
    setName: (name) => setSelector((s) => (s ? { ...s, name } : s)),
    setKind: (kind: ActorKind) =>
      setSelector((s) =>
        s ? { ...emptyActorState(s.actorId), name: s.name, kind } : s,
      ),
    setOrgType: (orgType) => setSelector((s) => (s ? { ...s, orgType } : s)),
    setOrgUnit: (orgUnit) =>
      setSelector((s) =>
        s ? { ...s, orgUnit, employee: null, manager: null } : s,
      ),
    selectGroup: (group: Group | null) =>
      setSelector((s) =>
        s
          ? {
              ...s,
              group: group
                ? {
                    id: group.id,
                    label: group.name,
                    image: group.image,
                    iconKind: "group",
                  }
                : null,
            }
          : s,
      ),
    setRole: (role: ActorRole) =>
      setSelector((s) =>
        s ? { ...s, role, orgUnit: null, employee: null, manager: null } : s,
      ),
    setEmployee: (employee) => setSelector((s) => (s ? { ...s, employee } : s)),
    setManager: (manager) => setSelector((s) => (s ? { ...s, manager } : s)),
    // Switching the source clears the value: a variable name and free text are
    // not interchangeable.
    setCustomSource: (customSource: ActorCustomSource) =>
      setSelector((s) => (s ? { ...s, customSource, customValue: "" } : s)),
    setCustomValue: (customValue) =>
      setSelector((s) => (s ? { ...s, customValue } : s)),
  };

  // Open the selector with a starting state (a blank one, or a previously saved
  // selection restored for editing) and the variables in scope at that point.
  const open = (
    initial: ActorSelectorState,
    variables: AvailableVariable[] = [],
  ): void => {
    setSelector(initial);
    setAvailableVariables(variables);
  };
  const close = (): void => setSelector(null);

  // Whether the current selection is complete enough to save.
  const canSave = selector ? buildActorAssignment(selector) !== null : false;
  // The label + props for the current selection, or null while incomplete.
  const build = (): ActorAssignment | null =>
    selector ? buildActorAssignment(selector) : null;

  return { selector, availableVariables, controls, open, close, canSave, build };
}
