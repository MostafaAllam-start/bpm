// Small id helpers for the React Flow modeler. BPMN ids must be valid XML NCName
// values (letter/underscore start, no spaces), and must be unique within a
// document. We mint readable, prefixed ids and de-duplicate against a live set.

let counter = 0;

// A fresh id with the given prefix, e.g. `UserTask_3`. Monotonic within a
// session; collisions with imported ids are avoided by `uniqueId`.
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

// Ensure an id is unique against `taken`, suffixing `_2`, `_3`, … if needed.
// Adds the chosen id to the set so repeated calls stay unique.
export function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  taken.add(id);
  return id;
}

// Turn a BPMN element type into an id prefix (StartEvent_1, UserTask_2, …).
export function prefixFor(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
