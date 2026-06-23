export { default } from "./BpmnModeler.tsx";
export type { ActorFormMeta, BpmnEditorProps, SavedActorForm } from "./types.ts";
// In-scope variables surfaced through the `onOpenActorForm` callback — part of
// this feature's public API (the host passes them to the form designer).
export type { AvailableVariable } from "./flow/utils/variables.ts";
