// Per-field and whole-form color support for the form-js form editor.
//
// form-js has no native field-color feature, so we store colors directly on the
// schema (which survives `saveSchema` — its `exportSchema` only strips
// `_parent`/`_path`) and render them as injected CSS that targets the editor
// preview, where every field is wrapped in `.fjs-element[data-id="<id>"]`.
//
//  - Per field:   `field.colors = { background?, label?, border?, input? }`
//  - Whole form:  `rootField.theme = { background?, label?, border?, input? }`
//
// The form theme provides defaults for every field; a field's own `colors`
// override the theme because the per-field selectors are more specific.

export type ColorTarget = "background" | "label" | "border" | "input";
export type ColorMap = Partial<Record<ColorTarget, string>>;

export const COLOR_TARGETS: readonly ColorTarget[] = [
  "background",
  "label",
  "border",
  "input",
];

const STYLE_ID = "fjs-field-colors";

// Only accept hex colors we produce ourselves (`<input type="color">` emits
// `#rrggbb`); anything else is ignored so a stray schema value can't inject CSS.
function isSafeColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function pick(colors: ColorMap): ColorMap {
  const out: ColorMap = {};
  for (const target of COLOR_TARGETS) {
    if (isSafeColor(colors[target])) out[target] = colors[target];
  }
  return out;
}

// CSS-escape an id used inside an attribute selector (`[data-id="..."]`).
function escapeId(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Shared declarations for a set of colors, given the selector that targets the
// field root (`background` paints the root; `label`/`border`/`input` target the
// label and input descendants).
function rulesFor(rootSelector: string, colors: ColorMap): string[] {
  const safe = pick(colors);
  const rules: string[] = [];
  if (safe.background) {
    // `!important` so a field's own background also shows while it is selected:
    // form-js paints a selection tint on `.fjs-element.fjs-editor-selected`
    // (higher specificity), which would otherwise hide the chosen color until
    // the field is deselected. The selection border stays visible regardless.
    rules.push(
      `${rootSelector} { background-color: ${safe.background} !important; }`,
    );
  }
  if (safe.label) {
    rules.push(
      `${rootSelector} .fjs-form-field-label { color: ${safe.label}; }`,
    );
  }
  if (safe.border || safe.input) {
    const decls: string[] = [];
    if (safe.border) decls.push(`border-color: ${safe.border};`);
    if (safe.input) decls.push(`color: ${safe.input};`);
    rules.push(`${rootSelector} .fjs-input { ${decls.join(" ")} }`);
  }
  return rules;
}

function themeRules(scope: string, theme: ColorMap): string[] {
  const safe = pick(theme);
  const rules: string[] = [];
  // The whole-form background paints the form preview area only. NOTE: in the
  // editor `.fjs-container` is the *entire editor* (palette + form +
  // properties), so we target `.fjs-form-container` (the scrollable form
  // preview) instead, otherwise the palette/properties would get colored too.
  if (safe.background) {
    rules.push(
      `${scope} .fjs-form-container { background-color: ${safe.background}; }`,
    );
  }
  if (safe.label) {
    rules.push(`${scope} .fjs-form-field-label { color: ${safe.label}; }`);
  }
  if (safe.border || safe.input) {
    const decls: string[] = [];
    if (safe.border) decls.push(`border-color: ${safe.border};`);
    if (safe.input) decls.push(`color: ${safe.input};`);
    rules.push(`${scope} .fjs-input { ${decls.join(" ")} }`);
  }
  return rules;
}

function collectFieldColors(
  field: any,
  out: Array<[string, ColorMap]>,
): void {
  if (!field || typeof field !== "object") return;
  if (field.id && field.colors && typeof field.colors === "object") {
    out.push([field.id, field.colors]);
  }
  if (Array.isArray(field.components)) {
    for (const child of field.components) collectFieldColors(child, out);
  }
}

// Build the full stylesheet for a schema: theme defaults first, then per-field
// overrides (later + more specific selectors win).
export function buildColorCss(schema: any, scope: string): string {
  if (!schema) return "";
  const rules: string[] = [];

  if (schema.theme && typeof schema.theme === "object") {
    rules.push(...themeRules(scope, schema.theme));
  }

  const fieldColors: Array<[string, ColorMap]> = [];
  for (const child of schema.components ?? []) {
    collectFieldColors(child, fieldColors);
  }
  for (const [id, colors] of fieldColors) {
    const root = `${scope} .fjs-element[data-id="${escapeId(id)}"]`;
    rules.push(...rulesFor(root, colors));
  }

  return rules.join("\n");
}

// Read the editor's current schema and (re)write the injected <style> element.
export function applyColorStyles(editor: any, scope: string): void {
  let schema: any;
  try {
    schema = editor.saveSchema();
  } catch {
    // Editor not ready / mid-import — nothing to render yet.
    return;
  }
  const css = buildColorCss(schema, scope);
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export function removeColorStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

// The live root form field (type `default`, no parent), used to read/write the
// whole-form theme via `modeling.editFormField`.
export function getRootField(editor: any): any {
  try {
    const registry = editor.get("formFieldRegistry");
    const all =
      typeof registry.getAll === "function" ? registry.getAll() : [];
    return all.find((field: any) => !field._parent) ?? null;
  } catch {
    return null;
  }
}
