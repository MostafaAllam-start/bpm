// The form schema — our own JSON model (no third-party form library).
//
// A form is a list of fields grouped into pages. The shape is intentionally
// plain JSON so it serializes cleanly via `onSave` / Download and round-trips
// through `Open`. Every field type is a member of the `FormField` union and is
// described by an entry in the field-type registry (`fieldTypes.tsx`).

// A piece of user-facing text that can be plain (single language) or localized
// per locale. The Translate tab upgrades a plain string into the object form;
// `resolveText` (text.ts) reads either shape for a given locale.
export type LocalizedText = string | ({ default: string } & Record<string, string>);

// The kinds of field we support. Add a new type here AND add its registry entry
// in `fieldTypes.tsx` — those are the only two places that need to know.
export type FieldType =
  | "text"
  | "email"
  | "number"
  | "date"
  | "comment"
  | "dropdown"
  | "radiogroup"
  | "checkbox"
  | "boolean"
  | "rating"
  | "signature"
  | "signatureupload"
  | "datetime"
  | "image"
  | "iframe"
  | "imageupload"
  | "fileupload"
  | "html";

// Responsive layout: how many grid columns (out of 12) a field spans at each
// breakpoint. Unset breakpoints inherit the next smaller one (base → sm → …),
// so `{ base: 12, md: 6 }` is full width on small screens and half from `md` up.
export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";
export type ColSpan = Partial<Record<Breakpoint, number>>;

// A single option for choice-based fields (dropdown / radio / checkboxes).
export type Choice = {
  value: string;
  text: LocalizedText;
};

// Where a choice field gets its options: a hand-entered list, or a remote API.
export type ChoicesSource = "manual" | "api";

// API options config. The response is fetched from `url`; `path` is a dot-path
// to the array of items within it (e.g. "categories.data"); each item's
// `valueKey` becomes the option value and `displayKey` its label.
export type ChoicesApi = {
  url: string;
  path?: string;
  valueKey: string;
  displayKey: string;
};

// A field on the form. Most properties are optional and only meaningful for
// some types (e.g. `choices` for choice fields, `inputType` for text); the
// registry's `editableProps` decides which the property panel exposes.
export type FormField = {
  type: FieldType;
  // A stable identifier for this field, distinct from `name`. Auto-generated on
  // creation and backfilled on load, so every field in a saved schema carries
  // one. Unlike `name` (the answer's data key, which the designer may rename),
  // `id` is meant as a durable handle. Editable in the property panel.
  id?: string;
  // The data key for this field's answer. Unique within the form.
  name: string;
  title?: LocalizedText;
  description?: LocalizedText;
  isRequired?: boolean;
  // Single-line text only: html input type (text/email/number/tel/url/…).
  inputType?: string;
  placeholder?: LocalizedText;
  // Choice fields. `choicesSource` selects manual vs API (default "manual");
  // `choices` holds the manual list, `choicesApi` the remote config.
  choices?: Choice[];
  choicesSource?: ChoicesSource;
  choicesApi?: ChoicesApi;
  // Checkboxes: cap the options list height (px) so a long list scrolls instead
  // of stretching the form. Unset = no cap.
  optionsMaxHeight?: number;
  // Rating: number of stars/points.
  rateMax?: number;
  // Info/HTML block content (not an input; carries no answer).
  html?: LocalizedText;
  // Display blocks (image / iframe): source URL, alt text, and pixel height.
  src?: string;
  alt?: LocalizedText;
  height?: number;
  // Signature: who provides it — the end-user fills the interactive pad
  // ("user", default), the designer embeds a fixed image set in the properties
  // ("preset", held in `signatureValue`), or it's bound to the signature of the
  // actor performing this step ("currentActor", inserted automatically at
  // runtime; only offered when the form's actor is a single employee).
  signatureSource?: "user" | "preset" | "currentActor";
  signatureValue?: string;
  // Preview image caps (px) for a signature: width/height maxes that keep the
  // image's aspect ratio instead of fitting it into a fixed box.
  previewMaxWidth?: number;
  previewMaxHeight?: number;
  // File-upload field: the accept filter (e.g. ".pdf,.docx" or "image/*").
  accept?: string;
  // Conditional logic expressions (see conditions.ts). When present, the field
  // is only shown / only required when the expression evaluates truthy.
  visibleIf?: string;
  requiredIf?: string;
  // Responsive width: grid columns spanned per breakpoint (see ColSpan).
  colSpan?: ColSpan;
};

// A page groups fields. We currently use a single page but keep the structure
// so multi-page forms are a later, non-breaking addition.
export type FormPage = {
  name: string;
  elements: FormField[];
};

// Visual theme, applied by the renderer as CSS variables. All optional; the
// renderer falls back to its built-in defaults.
export type ThemeSettings = {
  preset?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontScale?: number;
  cornerRadius?: number;
};

// The whole form. `theme` travels with the schema so a saved form keeps its
// look. This object is exactly what `onSave` emits and what `Open`/`existing`
// consume.
export type FormSchema = {
  title?: LocalizedText;
  description?: LocalizedText;
  pages: FormPage[];
  theme?: ThemeSettings;
};

// A file captured by the file-upload field: the original file's metadata plus
// its contents as a data URL, so it serializes with the form's answers.
export type FormFileValue = {
  name: string;
  type?: string;
  size?: number;
  dataUrl: string;
};

// Answers keyed by field name.
export type FormValues = Record<string, unknown>;

// Narrow an unknown value to a FormSchema we recognize. Used to reject legacy /
// foreign schemas (e.g. an old form-js blob left in memory) so we fall back to a
// fresh starter instead of crashing the designer.
export function isFormSchema(value: unknown): value is FormSchema {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.pages);
}
