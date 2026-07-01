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
  | "dynamictext"
  | "group"
  | "table"
  | "html"
  | "orderedlist"
  | "unorderedlist"
  | "button"
  | "divider"
  | "heading";

// CSS length units a field's width/height can be expressed in. The visual
// designer always works in canvas pixels for geometry (drag/resize/positioning);
// the unit is how that size is *expressed* in the saved schema and emitted by the
// runtime — so a designer can author in `%` (the default), `rem`, etc.
//
// `col` is special and offered for WIDTH only: the value is a column span on the
// form's (or the containing section's) grid — see `CanvasSettings.columns`. A
// field spanning the full column count fills its container's width, and a span
// can never exceed that count, so a column-sized field can't overflow the form
// or section. Stored geometry stays in px; `col` is resolved against the
// container's inner width at author time and emitted as a `%` at runtime.
export type CssUnit = "px" | "%" | "rem" | "em" | "ch" | "col";

// Responsive layout: how many grid columns (out of 12) a field spans at each
// breakpoint. Unset breakpoints inherit the next smaller one (base → sm → …),
// so `{ base: 12, md: 6 }` is full width on small screens and half from `md` up.
export type Breakpoint = "base" | "mobile" | "tablet" | "desktop";
export type ColSpan = Partial<Record<Breakpoint, number>>;

// Absolute placement of a field on the visual design canvas, in canvas pixels.
// This is the layout-builder model: every field becomes a movable/resizable
// widget positioned at (x, y) with an explicit size and stacking order.
//
// It is OPTIONAL and purely additive. Legacy schemas (and any field saved before
// the visual designer existed) carry no `layout`; the designer backfills one on
// load (see `ensureLayout` in designer/canvasLayout.ts) so every field can be
// dragged, and the runtime renderer falls back to responsive flow when a field
// has no layout or the viewport is too narrow to honor absolute positions.
export type LayoutBox = {
  x: number;
  y: number;
  width: number;
  // Canvas-pixel height; used as the authored size when autoHeight is false,
  // and as a layout-math fallback (push-down, submit placement) when true.
  height: number;
  // Stacking order on the canvas; higher renders on top. Also drives the flow
  // fallback's order alongside `y`.
  zIndex: number;
  // The unit the width / height are *expressed* in (default `%`). `width` and
  // `height` above are always canvas pixels — the source of truth for the
  // designer's geometry — and the unit is what the property panel shows/edits and
  // what the runtime emits, converting from px relative to the canvas (see
  // units.ts). Optional; absent means `%`.
  widthUnit?: CssUnit;
  heightUnit?: CssUnit;
  // When true the field sizes to fit its content; `height` is a fallback used
  // only for layout calculations (push-down, reflow). Vertical resize handles
  // are hidden on the canvas when this is active.
  autoHeight?: boolean;
  // CSS max-height (px) applied when autoHeight is true, so expanding content
  // doesn't overflow the page. Unset = no cap.
  maxHeight?: number;
};

// A single option for choice-based fields (dropdown / radio / checkboxes).
export type Choice = {
  value: string;
  text: LocalizedText;
};

// Where a choice field gets its options: a hand-entered list, or a remote API.
export type ChoicesSource = "manual" | "api";

// Where a display table gets its body rows: hand-entered cells ("manual"), or
// rows fetched from a remote API ("api").
export type TableSource = "manual" | "api";

// Per-cell visual overrides for a display table. `bg` / `borderColor` are CSS
// colour strings; `borderWidth` is in px. An unset key leaves the default
// (theme border, 1px, no background).
export type TableCellStyle = {
  bg?: string;
  borderColor?: string;
  borderWidth?: number;
};

// Which cell-bearing region a table cell belongs to: the header row ("h") or one
// of the manual body row sets. Used to build the stable per-cell key.
export type TableCellGroup = "h" | "rows" | "top" | "bottom";

// The table cell the designer currently has focused, surfaced so the property
// panel can edit that cell's / its column's / its row's properties. Transient
// UI state (not part of the schema).
export type TableSelection = {
  fieldName: string;
  group: TableCellGroup;
  row: number;
  col: number;
};

// API table config. The response is fetched from `url`; `path` is a dot-path to
// the array of row items within it (e.g. "data.rows"); `columnKeys[i]` is the
// item key whose value fills column i — one key per column, aligned to the
// table's `tableColumns`.
export type TableApi = {
  url: string;
  path?: string;
  columnKeys: string[];
};

// API options config. The response is fetched from `url`; `path` is a dot-path
// to the array of items within it (e.g. "categories.data"); each item's
// `valueKey` becomes the option value and `displayKey` its label.
export type ChoicesApi = {
  url: string;
  path?: string;
  valueKey: string;
  displayKey: string;
};

// API list-items config for ordered / unordered list fields. The response is
// fetched from `url`; `path` is a dot-path to the array of items; `displayKey`
// is the property on each object item to use as display text. Leave `displayKey`
// empty when the API returns a plain array of strings.
export type ListApi = {
  url: string;
  path?: string;
  displayKey?: string;
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
  // Dynamic-text block content (not an input; carries no answer). Plain,
  // localizable text that may embed `{variable}` placeholders — resolved at
  // render time against the form's own answers and any in-scope process /
  // upstream-form variables (see interpolation.ts).
  text?: LocalizedText;
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
  // Group container (`type: "group"`): a titled section box drawn behind the
  // fields placed within its bounds. Moving the group moves those fields with it.
  // When `collapsible` is true, the end user can expand/collapse the section to
  // show or hide its fields. Carries no answer.
  collapsible?: boolean;
  // Display table (`type: "table"`): a grid the designer fills in. Carries no
  // answer. `tableColumns` are the header-cell texts (one per column);
  // `tableHeader` toggles rendering the header row (default true). Header and
  // cell text may embed `{variable}` tokens, resolved at runtime against the
  // form/process scope.
  //
  // `tableSource` (default "manual") picks where the body rows come from:
  //  - "manual": `tableRows` — body rows, each an array of cell texts aligned to
  //    the columns.
  //  - "api": rows fetched per `tableApi`, optionally bracketed by the manual
  //    `tableTopRows` (rendered before) and `tableBottomRows` (rendered after) —
  //    e.g. a header summary or a totals row.
  tableColumns?: LocalizedText[];
  tableRows?: LocalizedText[][];
  tableHeader?: boolean;
  // When true the table grows to fit its rows instead of staying at the
  // designed box height and scrolling internally (the default fill-box
  // behaviour). The containing field box follows the table's content height.
  tableAutoHeight?: boolean;
  // Per-cell visual overrides (background / border colour), keyed by cell
  // position via `tableCellKey` — header cells and the manual body cells of
  // `tableRows` / `tableTopRows` / `tableBottomRows`. API-fetched rows aren't
  // keyed (their row identity isn't stable), so they carry no per-cell style.
  tableCellStyles?: Record<string, TableCellStyle>;
  tableSource?: TableSource;
  tableApi?: TableApi;
  tableTopRows?: LocalizedText[][];
  tableBottomRows?: LocalizedText[][];
  // List fields (orderedlist / unorderedlist): optional title, items to display,
  // (for unordered lists) the CSS list-style-type bullet shape, and typography /
  // colour overrides for both the title and the item text.
  listTitle?: LocalizedText;
  listItems?: LocalizedText[];
  // "manual" (default) uses the hand-entered `listItems`; "api" fetches items
  // from a remote endpoint described by `listItemsApi`.
  listItemsSource?: "manual" | "api";
  listItemsApi?: ListApi;
  listStyle?: string;
  listMaxHeight?: number;
  listStyleColor?: string;
  listTextColor?: string;
  listFontWeight?: string;
  listFontSize?: number;
  listFontFamily?: string;
  listTitleColor?: string;
  listTitleFontWeight?: string;
  listTitleFontSize?: number;
  listTitleFontFamily?: string;
  // Button field (`type: "button"`): visual style, link URL, and action config.
  // Two modes: link mode (url set) opens the URL and does nothing else;
  // action mode (no url) applies `assignments` then optionally closes the form.
  variant?: "primary" | "danger" | "success";
  url?: string;
  urlTarget?: "_blank" | "_self";
  assignments?: Array<{ variable: string; value: string }>;
  closeOnClick?: boolean;
  // Heading field (`type: "heading"`): the HTML tag level (h1–h6), and
  // optional typography / colour overrides. Text content lives in `title`.
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  headingTextColor?: string;
  headingBgColor?: string;
  headingFontSize?: number;
  headingFontWeight?: string;
  headingFontStyle?: "normal" | "italic";
  headingFontFamily?: string;
  headingTextAlign?: "left" | "center" | "right";
  // Conditional logic expressions (see conditions.ts). When present, the field
  // is only shown / only required when the expression evaluates truthy.
  visibleIf?: string;
  requiredIf?: string;
  // Responsive width: grid columns spanned per breakpoint (see ColSpan).
  colSpan?: ColSpan;
  // Section (`type: "group"`) background image and related CSS properties.
  backgroundImage?: string;
  backgroundRepeat?: "no-repeat" | "repeat" | "repeat-x" | "repeat-y" | "space" | "round";
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundAttachment?: "scroll" | "fixed" | "local";
  backgroundOrigin?: "padding-box" | "border-box" | "content-box";
  backgroundClip?: "padding-box" | "border-box" | "content-box";
  // Absolute placement on the visual design canvas (see LayoutBox). Optional:
  // absent on legacy fields, backfilled by the designer on load. This is the
  // BASE layout (the `All` general design) — it applies to every screen unless
  // that screen has its own override.
  layout?: LayoutBox;
  // Per-breakpoint layout overrides (responsive design). Keyed by breakpoint
  // (sm..xxl; `base` lives in `layout`). An override applies to its own
  // breakpoint ONLY — each screen is independent; screens without an override use
  // the base `layout`. See `resolveLayout` in responsive.ts. Only the breakpoints
  // the designer actually customized are present.
  responsive?: Partial<Record<Breakpoint, LayoutBox>>;
};

// A page groups fields. We currently use a single page but keep the structure
// so multi-page forms are a later, non-breaking addition.
export type FormPage = {
  name: string;
  elements: FormField[];
};

// The design canvas's own dimensions, in canvas pixels. `width` defines the
// form's intended (desktop) width — the runtime honors absolute layout when the
// available width is at least this — and `height` the canvas page's extent. Both
// are part of the schema so a saved form remembers its design surface. Optional;
// `ensureLayout` fills in defaults.
//
// `autoWidth` (default true) means the page width is not pinned: when the form
// opens in the designer it's fitted to the available canvas width and the fields
// are scaled to match, so the form fills the canvas. Setting an explicit width
// turns this off and the stored `width` is honored as-is.
export type CanvasSettings = {
  width: number;
  height: number;
  autoWidth?: boolean;
  // Default spacing (px) the designer keeps between elements. `gapY` is the
  // vertical gap used when stacking/reflowing fields (resize push, new-field
  // placement, sortable reorder); `gapX` is the horizontal gap used when a
  // resize pushes side-by-side neighbours apart. Optional; both default to the
  // built-in FIELD_GAP.
  gapX?: number;
  gapY?: number;
  // How many columns the form's width is divided into for column-based field
  // sizing (the `col` width unit). The designer draws this many guide columns on
  // the canvas and a field's `col` width snaps to / is capped at this count.
  // Sections reuse the same count across their own inner width. Optional;
  // defaults to 12.
  columns?: number;
  // The form's maximum rendered width (px). The absolute design is stretched
  // horizontally to fill its container up to this cap, then centred — so the
  // form (and its full-width fields) fills the available width without growing
  // unbounded on very wide screens. Optional; unset means no cap (fills the
  // container in Preview's fit mode, or renders at the design width at runtime).
  maxWidth?: number;
  // PDF-mode page size. Determines the fixed canvas width/height for each page.
  // "a4" → 794×1123 px, "letter" → 816×1056 px, "a3" → 1123×1588 px at 96 dpi.
  // "custom" uses pageWidth/pageHeight directly. Absent means no fixed page size.
  pageSize?: "a4" | "letter" | "a3" | "custom";
  pageWidth?: number;
  pageHeight?: number;
};

// The form's submit button as a positioned element. It carries no answer (it's
// not a data field), but it participates in the visual layout: it can be moved
// and resized like a widget, though it can't be deleted. The designer seeds one
// below the content on open; the runtime renders it at this box in absolute mode.
export type SubmitButton = {
  layout: LayoutBox;
  // Per-breakpoint overrides for the submit button, like a field's `responsive`.
  responsive?: Partial<Record<Breakpoint, LayoutBox>>;
  label?: LocalizedText;
};

// The form's title as a positioned, styleable canvas element. Like the submit
// button it participates in the visual layout — it can be moved and resized but
// not deleted — and it carries its own typography (size / family / weight /
// style / color). The title TEXT itself stays on `FormSchema.title`; this holds
// only its placement and look. The designer seeds one at the top of the canvas
// on open; the runtime renders the title at this box in absolute mode.
export type FormTitle = {
  layout: LayoutBox;
  // Per-breakpoint overrides for the title box, like a field's `responsive`.
  responsive?: Partial<Record<Breakpoint, LayoutBox>>;
  // Typography. All optional; the renderer falls back to its built-in heading
  // style. `fontSize` is in px; `fontFamily` is a CSS font stack (empty = theme
  // default); `color` is any CSS color.
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
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
  // Visual designer canvas dimensions (see CanvasSettings). Optional; legacy
  // schemas omit it and the designer fills in a default on load.
  canvas?: CanvasSettings;
  // The form's submit button placement (see SubmitButton). Seeded by the
  // designer on open if absent.
  submit?: SubmitButton;
  // The form title's placement + typography (see FormTitle). Seeded by the
  // designer on open if absent; the title text lives on `title` above.
  titleBox?: FormTitle;
  // Whether the form shows a submit button. Defaults to true when absent.
  // Set to false for non-submittable forms (e.g. modal dialogs with action buttons).
  submittable?: boolean;
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
