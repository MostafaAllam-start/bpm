import { ACTOR_ELEMENT_TYPES, BPMN_TYPE_LABELS } from "../constants.ts";

// Whether a diagram element is one we treat as an actor (and therefore can
// carry an actor assignment / attached form).
export function isActorElement(element: any): boolean {
  const type = element?.businessObject?.$type ?? element?.type;
  return ACTOR_ELEMENT_TYPES.has(type);
}

// Best-effort human-readable label for an actor element: prefer an explicit
// actor selection / name, then fall back through the element type to its id.
export function getActorLabel(element: any): string {
  const businessObject = element?.businessObject;
  const type = businessObject?.$type || element?.type;
  const typeLabel = type
    ? BPMN_TYPE_LABELS[type] || type.replace(/^bpmn:/, "")
    : undefined;

  return (
    businessObject?.actorSelection ||
    businessObject?.name ||
    businessObject?.actorType ||
    typeLabel ||
    businessObject?.id ||
    element?.id ||
    "Actor"
  );
}
