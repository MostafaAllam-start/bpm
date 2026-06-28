import type { VariableRef } from "@shared/variables.ts";

// Extends VariableRef with an optional right-column badge shown in the dropdown
// (e.g. variable type for BPMN, source task name for form designer).
// Callers set `meta` to whatever is most useful in their context.
export type MentionVar = VariableRef & { meta?: string };

export type MentionGroup = {
  key: string;
  label: string;
  vars: MentionVar[];
};
