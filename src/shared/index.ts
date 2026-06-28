// Public API of the cross-cutting `shared` layer — primitives depended on by
// both features (and the shell). Grows as the restructure proceeds (Modal,
// error helpers, …). Import from `@shared`.

export type { VariableOrigin, VariableRef } from "./variables.ts";
export { default as Modal } from "./Modal/index.ts";
export { default as MentionInput, MentionChip, makeChip, MentionDropdown } from "./MentionInput";
export type { MentionVar, MentionGroup, MentionInputProps } from "./MentionInput";
