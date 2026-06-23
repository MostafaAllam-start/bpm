// Public API of the form engine + designer. Other features (e.g. the BPMN
// modeler, the app shell) import from `@forms` and never reach into deep
// internals — that keeps the boundary explicit and lets forms reorganize freely
// behind this barrel. Internal forms files keep importing each other relatively.

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
export { buildExpression, evaluateExpression, parseExpression } from "./conditions.ts";
export type { Condition, ConditionGroup, ConditionOp } from "./conditions.ts";

// Remote "options/value from API" helpers (also used for BPMN API variables).
export { getByPath, resolveFetchUrl } from "./fields/apiSource.ts";

// Localized-text resolution + responsive layout expansion.
export { resolveText } from "./text.ts";
export { resolveFormLayouts } from "./responsive.ts";

// The dynamic-text picker's variable shape (consumed by the host shell).
export type { DesignerVariable } from "./designer/PropertyPanel.tsx";
