// `{variable}` interpolation for dynamic display text. A template string may
// embed `{name}` tokens which are replaced at render time with the matching
// value from a scope — the form's own answers merged with any in-scope process
// / upstream-form variables. No third-party templating library.
//
// A token's `name` is a variable key: letters, digits, underscore, dot and
// hyphen (so dotted process-variable names like `order.total` work). Anything
// that isn't a recognized token (e.g. `{ not a var }`, or a stray brace) is
// left untouched.

// Matches a single `{name}` token. Kept deliberately strict so prose with
// braces (rare, but possible) isn't mangled.
const TOKEN = /\{([A-Za-z0-9_.-]+)\}/g;

// Render a single value as display text. Arrays join with ", " (e.g. a
// checkbox field's selected values); objects fall back to JSON; everything else
// is stringified. `null`/`undefined` render as empty.
function formatValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// Replace every `{name}` token in `template` with its value from `scope`.
//
// By default an unresolved token (name absent from the scope, or present but
// null/undefined) is left as the literal `{name}` — this keeps bindings visible
// in the designer canvas (where no scope is supplied) and flags a mis-typed
// variable at runtime. Pass `{ keepMissing: false }` to blank them instead.
export function interpolate(
  template: string | undefined,
  scope: Record<string, unknown> = {},
  opts: { keepMissing?: boolean } = {},
): string {
  if (!template) return "";
  const keepMissing = opts.keepMissing ?? true;
  return template.replace(TOKEN, (whole, rawName: string) => {
    const name = rawName.trim();
    const value = Object.prototype.hasOwnProperty.call(scope, name)
      ? scope[name]
      : undefined;
    if (value == null) return keepMissing ? whole : "";
    return formatValue(value);
  });
}

// The distinct variable names referenced by a template, in first-seen order.
// Used to highlight which bindings a dynamic-text field depends on.
export function tokensIn(template: string | undefined): string[] {
  if (!template) return [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(template)) !== null) {
    seen.add(match[1].trim());
  }
  return [...seen];
}
