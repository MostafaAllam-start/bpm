// A tiny, self-contained expression evaluator for `visibleIf` / `requiredIf`.
// No third-party expression library.
//
// Flat grammar (single group):
//   expression := comparison ( ("and" | "or") comparison )*
//   comparison := "{" name "}" op operand
//   op         := "=" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains"
//   operand    := "{" name "}" | literal
//   literal    := 'single-quoted' | "double-quoted" | number | true | false
//
// Grouped grammar (two-level AND/OR, produced by the condition modal):
//   grouped    := group ( connector group )*
//   group      := "(" expression ")" | comparison
//   connector  := " and " | " or "
//
// Examples (flat):
//   {age} >= 18
//   {country} = 'EG' and {subscribe} = true
// Examples (grouped):
//   ({age} >= 18 and {country} = 'EG') or ({vip} = true)

import type { FormValues } from "../types";

export type ConditionOp =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains";

export type Condition = {
  field: string;
  op: ConditionOp;
  value: string;
};

// A flat group of conditions joined by one connector (used by the Logic tab
// and as the sub-unit inside a GroupedCondition).
export type ConditionGroup = {
  connector: "and" | "or";
  conditions: Condition[];
};

// Two-level grouped conditions: multiple ConditionGroups joined by a top-level
// connector. Produced and consumed by the gateway condition modal.
export type GroupedCondition = {
  groupConnector: "and" | "or";
  groups: ConditionGroup[];
};

const TOKEN = /\{([^}]+)\}\s*(>=|<=|==|!=|=|>|<|contains)\s*('[^']*'|"[^"]*"|[^\s)]+)/gi;

function parseLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

// Resolve the right-hand operand. A `{name}` reference reads the current value
// of that variable; anything else is a literal.
function resolveOperand(raw: string, values: FormValues): unknown {
  const ref = /^\s*\{([^}]+)\}\s*$/.exec(raw);
  if (ref) return values[ref[1].trim()];
  return parseLiteral(raw);
}

function compare(left: unknown, op: ConditionOp, right: unknown): boolean {
  switch (op) {
    case "=":
      // eslint-disable-next-line eqeqeq
      return left == right;
    case "!=":
      // eslint-disable-next-line eqeqeq
      return left != right;
    case ">":
      return Number(left) > Number(right);
    case "<":
      return Number(left) < Number(right);
    case ">=":
      return Number(left) >= Number(right);
    case "<=":
      return Number(left) <= Number(right);
    case "contains":
      if (Array.isArray(left)) return left.map(String).includes(String(right));
      return String(left ?? "").includes(String(right));
    default:
      return false;
  }
}

// Normalize a boolean stored as itself (our boolean field stores true/false).
function normalize(value: unknown): unknown {
  return value;
}

// Evaluate a single parsed Condition against live values.
function evaluateCondition(c: Condition, values: FormValues): boolean {
  const left = normalize(values[c.field]);
  // c.value may be a {ref} reference or a literal already processed by parseLiteral→String.
  const ref = /^\{([^}]+)\}$/.exec(c.value.trim());
  const right = ref ? values[ref[1]] : parseLiteral(c.value);
  return compare(left, c.op, right);
}

// Evaluate an expression string against the current answers. An empty/blank
// expression is treated as "always true" (i.e. unconditional). Handles both
// the flat format and the parenthesized grouped format.
export function evaluateExpression(
  expression: string | undefined,
  values: FormValues,
): boolean {
  if (!expression || !expression.trim()) return true;

  const trimmed = expression.trim();

  // Grouped expression (starts with a paren-wrapped group).
  if (trimmed.startsWith("(")) {
    const gc = parseGroupedExpression(trimmed);
    const groupResults = gc.groups.map((g) => {
      if (g.conditions.length === 0) return true;
      const results = g.conditions.map((c) => evaluateCondition(c, values));
      return g.connector === "or" ? results.some(Boolean) : results.every(Boolean);
    });
    if (groupResults.length === 0) return true;
    return gc.groupConnector === "or"
      ? groupResults.some(Boolean)
      : groupResults.every(Boolean);
  }

  // Flat expression (original grammar).
  const usesOr = /\bor\b/i.test(expression);
  const results: boolean[] = [];
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(expression)) !== null) {
    const [, field, op, literal] = match;
    const left = values[field.trim()];
    const right = resolveOperand(literal, values);
    results.push(compare(normalize(left), op as ConditionOp, right));
  }
  if (results.length === 0) return true;
  return usesOr ? results.some(Boolean) : results.every(Boolean);
}

// ── Builder ⇄ string (flat, used by the Logic tab) ────────────────────────

function quote(value: string): string {
  if (value === "true" || value === "false") return value;
  if (value !== "" && !Number.isNaN(Number(value))) return value;
  // A `{name}` reference is an operand, not a string literal — leave it bare.
  if (/^\{[^}]+\}$/.test(value.trim())) return value.trim();
  return `'${value.replace(/'/g, "")}'`;
}

// Serialize a flat ConditionGroup back into an expression string.
export function buildExpression(group: ConditionGroup): string {
  const parts = group.conditions
    .filter((c) => c.field)
    .map((c) => `{${c.field}} ${c.op} ${quote(c.value)}`);
  return parts.join(` ${group.connector} `);
}

// Parse an expression string into a flat ConditionGroup for editing. Falls
// back to an empty `and` group when the string is blank or unparseable.
export function parseExpression(expression: string | undefined): ConditionGroup {
  const group: ConditionGroup = { connector: "and", conditions: [] };
  if (!expression || !expression.trim()) return group;
  group.connector = /\bor\b/i.test(expression) ? "or" : "and";

  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(expression)) !== null) {
    const [, field, op, literal] = match;
    const parsed = parseLiteral(literal);
    group.conditions.push({
      field: field.trim(),
      op: op as ConditionOp,
      value: String(parsed),
    });
  }
  return group;
}

// ── Grouped builder ⇄ string (two-level AND/OR) ───────────────────────────

// Serialize a GroupedCondition to an expression string. A single group with
// one condition produces a plain flat expression for backward compatibility.
export function buildGroupedExpression(gc: GroupedCondition): string {
  const nonEmpty = gc.groups.filter((g) => g.conditions.some((c) => c.field));
  if (nonEmpty.length === 0) return "";
  if (nonEmpty.length === 1) return buildExpression(nonEmpty[0]);
  const parts = nonEmpty
    .map((g) => {
      const expr = buildExpression(g);
      if (!expr) return null;
      // Wrap multi-condition groups in parens to disambiguate the nested logic.
      return g.conditions.filter((c) => c.field).length > 1
        ? `(${expr})`
        : expr;
    })
    .filter(Boolean) as string[];
  return parts.join(` ${gc.groupConnector} `);
}

// Split `str` by `sep` only at depth 0 (outside parentheses).
function splitTopLevel(str: string, sep: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "(") { depth++; continue; }
    if (str[i] === ")") { depth--; continue; }
    if (depth === 0 && str.startsWith(sep, i)) {
      chunks.push(str.slice(start, i).trim());
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  chunks.push(str.slice(start).trim());
  return chunks;
}

// Parse an expression string into a GroupedCondition. Flat expressions (no
// leading paren) parse as a single group for backward compatibility.
export function parseGroupedExpression(
  expression: string | undefined,
): GroupedCondition {
  const empty: GroupedCondition = {
    groupConnector: "or",
    groups: [{ connector: "and", conditions: [] }],
  };
  if (!expression || !expression.trim()) return empty;

  const trimmed = expression.trim();

  // Flat expression — wrap in a single group.
  if (!trimmed.startsWith("(")) {
    return { groupConnector: "or", groups: [parseExpression(trimmed)] };
  }

  // Detect which connector joins groups at depth 0.
  let groupConnector: "and" | "or" = "or";
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "(") { depth++; continue; }
    if (trimmed[i] === ")") { depth--; continue; }
    if (depth === 0) {
      const rest = trimmed.slice(i).toLowerCase();
      if (rest.startsWith(" or ")) { groupConnector = "or"; break; }
      if (rest.startsWith(" and ")) { groupConnector = "and"; break; }
    }
  }

  const chunks = splitTopLevel(trimmed, ` ${groupConnector} `);
  const groups = chunks.map((chunk) => {
    const inner =
      chunk.startsWith("(") && chunk.endsWith(")")
        ? chunk.slice(1, -1).trim()
        : chunk;
    return parseExpression(inner);
  });

  return {
    groupConnector,
    groups: groups.length > 0 ? groups : empty.groups,
  };
}
