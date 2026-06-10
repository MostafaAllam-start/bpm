import { useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type BpmnModeler from "bpmn-js/lib/Modeler";

import type { ActorKind, ActorRole } from "../constants.ts";
import type { Group } from "../api/types.ts";
import { buildActorAssignment } from "../lib/actorAssignment.ts";
import { useActorStore } from "../store/actorStore.ts";
import type {
  ActorControls,
  ActorSelectorState,
  BpmnEditorProps,
  ContextMenuState,
  SelectOption,
} from "../types.ts";

type UseActorSelectorParams = {
  modelerRef: RefObject<BpmnModeler | null>;
  onOpenActorForm: BpmnEditorProps["onOpenActorForm"];
  setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
};

// A fresh, empty selector for the given element (default kind = org unit).
function emptyState(actorId: string): ActorSelectorState {
  return {
    actorId,
    name: "",
    kind: "orgunit",
    orgType: null,
    orgUnit: null,
    group: null,
    groupEmployees: [],
    role: "employee",
    employee: null,
    manager: null,
    customValue: "",
  };
}

const employeeOption = (employee: Group["employees"][number]): SelectOption => ({
  id: employee.id,
  label: employee.name,
  sublabel: employee.orgUnitName ?? undefined,
  image: employee.image,
});

// Owns the actor selector: the cascading selection state, the context-menu
// actions that open it, and writing the chosen actor back onto the element.
export function useActorSelector({
  modelerRef,
  onOpenActorForm,
  setContextMenu,
}: UseActorSelectorParams) {
  const [actorSelector, setActorSelector] = useState<ActorSelectorState | null>(
    null,
  );

  function closeActorSelector(): void {
    setActorSelector(null);
  }

  function openActorSelector(actorId: string): void {
    // Restore the previously saved form data for this element if there is any,
    // so reopening the selector shows the last choice instead of resetting.
    const saved = useActorStore.getState().getActor(actorId);
    setActorSelector(saved ? { actorId, ...saved } : emptyState(actorId));
    setContextMenu(null);
  }

  function createActorForm(actorId: string, actorLabel: string): void {
    setContextMenu(null);
    onOpenActorForm?.(actorId, actorLabel);
  }

  // Each setter clears any now-stale downstream selections so the cascade stays
  // consistent (e.g. changing the org unit drops the employee/manager picked
  // under the previous one).
  const controls: ActorControls = {
    setName: (name: string) =>
      setActorSelector((s) => (s ? { ...s, name } : s)),
    // Changing the kind clears the cascade below it, but the name describes the
    // actor regardless of kind, so carry it over.
    setKind: (kind: ActorKind) =>
      setActorSelector((s) =>
        s ? { ...emptyState(s.actorId), name: s.name, kind } : s,
      ),
    setOrgType: (orgType) => setActorSelector((s) => (s ? { ...s, orgType } : s)),
    setOrgUnit: (orgUnit) =>
      setActorSelector((s) =>
        s ? { ...s, orgUnit, employee: null, manager: null } : s,
      ),
    selectGroup: (group: Group | null) =>
      setActorSelector((s) =>
        s
          ? {
              ...s,
              group: group
                ? { id: group.id, label: group.name, image: group.image }
                : null,
              groupEmployees: group ? group.employees.map(employeeOption) : [],
              employee: null,
            }
          : s,
      ),
    setRole: (role: ActorRole) =>
      setActorSelector((s) =>
        s ? { ...s, role, orgUnit: null, employee: null, manager: null } : s,
      ),
    setEmployee: (employee) => setActorSelector((s) => (s ? { ...s, employee } : s)),
    setManager: (manager) => setActorSelector((s) => (s ? { ...s, manager } : s)),
    setCustomValue: (customValue: string) =>
      setActorSelector((s) => (s ? { ...s, customValue } : s)),
  };

  function confirmActorSelection(): void {
    const modeler = modelerRef.current;
    if (!modeler || !actorSelector) return;

    const assignment = buildActorAssignment(actorSelector);
    if (!assignment) return;

    // Persist the form data so reopening the selector restores this choice.
    useActorStore.getState().saveActor(actorSelector);

    const modeling = modeler.get<any>("modeling");
    const elementRegistry = modeler.get<any>("elementRegistry");
    const element = elementRegistry.get(actorSelector.actorId);
    if (element) {
      modeling.updateProperties(element, {
        name: assignment.name,
        ...assignment.props,
      });
    }
    setActorSelector(null);
  }

  const canSave = actorSelector
    ? buildActorAssignment(actorSelector) !== null
    : false;

  return {
    actorSelector,
    openActorSelector,
    closeActorSelector,
    createActorForm,
    confirmActorSelection,
    canSave,
    controls,
  };
}
