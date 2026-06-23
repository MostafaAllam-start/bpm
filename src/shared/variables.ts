// The domain-agnostic core every "variable" shape shares across the app. No BPM
// or form-engine concepts leak in here on purpose: both features derive their own
// variable types from this base and import THIS module, never each other's types.
// That keeps the form designer decoupled from the BPM modeler (and avoids an
// import cycle) while letting a value flow across the seam without a lossy
// hand-written remap.

// Where a variable comes from — groups the mention dropdown / condition builder.
export type VariableOrigin = "global" | "task";

export type VariableRef = {
  // Display name / field key (shown in pickers, used for filtering).
  name: string;
  // The token actually inserted & resolved: a field's stable id, or the bare
  // name for a process global. Absent → falls back to `name`.
  ref?: string;
  // Origin, used to group the picker. Absent → treated as a process variable.
  origin?: VariableOrigin;
  // Human label for a tooltip / group heading (the producing task name);
  // undefined for a process global.
  source?: string;
};
