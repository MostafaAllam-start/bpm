import { useState } from "react";

import type { ActorKind, ActorRole } from "../../constants.ts";
import type { Group } from "../../api/types.ts";
import { buildActorAssignment } from "../../lib/actorAssignment.ts";
import { useActorStore } from "../../store/actorStore.ts";
import type {
  ActorControls,
  ActorFormMeta,
  ActorSelectorState,
  BpmnEditorProps,
} from "../../types.ts";
import type { FlowModeler } from "./useFlowModeler.ts";

// The actor-selector logic, identical in behaviour to the old `useActorSelector`
// but writing the chosen actor onto a React Flow node's `data` (name + flat
// `actorKind`/`actorPrimaryId`/… props) instead of a bpmn-js business object.
// The cascading selection state and the actor store are unchanged.

type Params = {
  modeler: FlowModeler;
  onOpenActorForm: BpmnEditorProps["onOpenActorForm"];
  // Close the right-click menu when an actor action is chosen.
  onCloseMenu: () => void;
};

function emptyState(actorId: string): ActorSelectorState {
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
    customValue: "",
  };
}

function actorFormMeta(actorId: string): ActorFormMeta {
  const actor = useActorStore.getState().getActor(actorId);
  const isEmployee =
    actor?.kind === "employee" ||
    (actor?.kind === "role" && actor?.role === "employee");
  return {
    isEmployee: Boolean(isEmployee),
    employeeName: isEmployee ? actor?.employee?.label ?? null : null,
  };
}

export function useFlowActorSelector({
  modeler,
  onOpenActorForm,
  onCloseMenu,
}: Params) {
  const [actorSelector, setActorSelector] = useState<ActorSelectorState | null>(null);

  function closeActorSelector(): void {
    setActorSelector(null);
  }

  function openActorSelector(actorId: string): void {
    const saved = useActorStore.getState().getActor(actorId);
    setActorSelector(saved ? { actorId, ...saved } : emptyState(actorId));
    onCloseMenu();
  }

  function createActorForm(actorId: string, actorLabel: string): void {
    onCloseMenu();
    onOpenActorForm?.(actorId, actorLabel, actorFormMeta(actorId));
  }

  const controls: ActorControls = {
    setName: (name) => setActorSelector((s) => (s ? { ...s, name } : s)),
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
      setActorSelector((s) =>
        s ? { ...s, role, orgUnit: null, employee: null, manager: null } : s,
      ),
    setEmployee: (employee) => setActorSelector((s) => (s ? { ...s, employee } : s)),
    setManager: (manager) => setActorSelector((s) => (s ? { ...s, manager } : s)),
    setCustomValue: (customValue) =>
      setActorSelector((s) => (s ? { ...s, customValue } : s)),
  };

  function confirmActorSelection(): void {
    if (!actorSelector) return;
    const assignment = buildActorAssignment(actorSelector);
    if (!assignment) return;

    useActorStore.getState().saveActor(actorSelector);

    // Write the actor's flat props onto the node, leaving the task's own `name`
    // untouched: the assigned actor is shown separately from the task title (see
    // `actorLabel` in the node renderer), not as the name. Replace the previous
    // actor* props wholesale so a re-selection doesn't leave stale keys behind.
    const node = modeler.nodes.find((n) => n.id === actorSelector.actorId);
    if (node) {
      const kept = Object.fromEntries(
        Object.entries(node.data.props).filter(([k]) => !k.startsWith("actor")),
      );
      modeler.updateNodeData(actorSelector.actorId, {
        props: { ...kept, ...assignment.props },
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
