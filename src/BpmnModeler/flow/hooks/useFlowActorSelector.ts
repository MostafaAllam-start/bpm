import { useActorStore } from "../../store/actorStore.ts";
import type {
  ActorFormMeta,
  BpmnEditorProps,
  SavedActorForm,
} from "../../types.ts";
import { availableVariablesAt } from "../utils/variables.ts";
import { emptyActorState, useActorPicker } from "./useActorPicker.ts";
import type { FlowModeler } from "./useFlowModeler.ts";

// The actor-selector logic for task assignment: it drives the shared cascading
// selector (`useActorPicker`) and, on confirm, writes the chosen actor onto a
// React Flow node's `data` (name + flat `actorKind`/`actorPrimaryId`/… props),
// remembering the selection in the actor store so re-opening restores it.

type Params = {
  modeler: FlowModeler;
  onOpenActorForm: BpmnEditorProps["onOpenActorForm"];
  // The saved forms per actor — needed to compute which upstream-form variables
  // are in scope when opening a task's form.
  savedActorForms: Record<string, SavedActorForm>;
  // Close the right-click menu when an actor action is chosen.
  onCloseMenu: () => void;
};

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
  savedActorForms,
  onCloseMenu,
}: Params) {
  const picker = useActorPicker();

  function closeActorSelector(): void {
    picker.close();
  }

  function openActorSelector(actorId: string): void {
    const saved = useActorStore.getState().getActor(actorId);
    // The variables a "custom" actor can read from: process globals plus
    // everything the upstream forms produce at this task.
    const availableVariables = availableVariablesAt({
      nodes: modeler.nodes,
      edges: modeler.edges,
      savedActorForms,
      globals: modeler.processMeta.processVariables,
      nodeId: actorId,
      // The form designer offers the edited task's own fields separately ("This
      // form"), so don't also surface them as a self-group of upstream variables.
      excludeSelf: true,
    });
    // Spread over a blank state so selections saved before a field existed
    // (e.g. `customSource`) get its default rather than `undefined`.
    picker.open(
      saved ? { ...emptyActorState(actorId), ...saved } : emptyActorState(actorId),
      availableVariables,
    );
    onCloseMenu();
  }

  function createActorForm(actorId: string, actorLabel: string): void {
    onCloseMenu();
    // Variables in scope at this task: process globals plus everything the
    // upstream forms produce — offered as `{name}` tokens in the dynamic-text
    // editor.
    const availableVariables = availableVariablesAt({
      nodes: modeler.nodes,
      edges: modeler.edges,
      savedActorForms,
      globals: modeler.processMeta.processVariables,
      nodeId: actorId,
      // The form designer offers the edited task's own fields separately ("This
      // form"), so don't also surface them as a self-group of upstream variables.
      excludeSelf: true,
    });
    onOpenActorForm?.(actorId, actorLabel, actorFormMeta(actorId), availableVariables);
  }

  function confirmActorSelection(): void {
    const selector = picker.selector;
    if (!selector) return;
    const assignment = picker.build();
    if (!assignment) return;

    useActorStore.getState().saveActor(selector);

    // Write the actor's flat props onto the node, leaving the task's own `name`
    // untouched: the assigned actor is shown separately from the task title (see
    // `actorLabel` in the node renderer), not as the name. Replace the previous
    // actor* props wholesale so a re-selection doesn't leave stale keys behind.
    const node = modeler.nodes.find((n) => n.id === selector.actorId);
    if (node) {
      const kept = Object.fromEntries(
        Object.entries(node.data.props).filter(([k]) => !k.startsWith("actor")),
      );
      modeler.updateNodeData(selector.actorId, {
        props: { ...kept, ...assignment.props },
      });
    }
    picker.close();
  }

  return {
    actorSelector: picker.selector,
    actorVariables: picker.availableVariables,
    openActorSelector,
    closeActorSelector,
    createActorForm,
    confirmActorSelection,
    canSave: picker.canSave,
    controls: picker.controls,
  };
}
