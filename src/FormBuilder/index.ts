// Public API of the form feature (this folder holds the whole thing). It is the
// LIGHT engine surface — schema model, runtime FormRenderer, condition grammar,
// API helpers — deliberately NOT re-exporting the FormBuilder *designer* entry,
// because that pulls the heavy designer UI (interact.js, i18n side-effects) and
// would drag it into every `@FormBuilder` consumer (incl. node-env unit tests).
// Import the designer component directly from `@FormBuilder/FormBuilder`.
// The designer/, fields/, and utils/ subfolders are otherwise private.

// Schema model + the runtime renderer.
export { isFormSchema } from "./types.ts";
export type {
  Choice,
  FieldType,
  FormField,
  FormSchema,
  FormValues,
  LocalizedText,
} from "./types.ts";
export { default as FormRenderer } from "./FormRenderer.tsx";

// Condition grammar (shared by the form Logic tab and the BPMN gateway builder).
export {
  buildExpression,
  buildGroupedExpression,
  evaluateExpression,
  parseExpression,
  parseGroupedExpression,
} from "./utils/conditions.ts";
export type {
  Condition,
  ConditionGroup,
  ConditionOp,
  GroupedCondition,
} from "./utils/conditions.ts";

// Remote "options/value from API" helpers (also used for BPMN API variables).
export { getByPath, resolveFetchUrl } from "./fields/apiSource.ts";

// Localized-text resolution + responsive layout expansion.
export { resolveText } from "./utils/text.ts";
export { resolveFormLayouts } from "./utils/responsive.ts";

// The dynamic-text picker's variable shape (consumed by the host shell).
export type { DesignerVariable } from "./designer/PropertyPanel.tsx";
