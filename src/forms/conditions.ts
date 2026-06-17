// A tiny, self-contained expression evaluator for `visibleIf` / `requiredIf`.
// No third-party expression library.
//
// Grammar (intentionally small, extendable later):
//   expression := comparison ( ("and" | "or") comparison )*
//   comparison := "{" name "}" op literal
//   op         := "=" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains"
//   literal    := 'single-quoted' | "double-quoted" | number | true | false
//
// Examples:
//   {age} >= 18
//   {country} = 'EG' and {subscribe} = true
//   {role} contains 'admin' or {vip} = true
//
// All comparisons in a chain share one connector (`and` OR `or`) — good enough
// for the curated Logic tab and easy to reason about. Mixed/nested logic is a
// later enhancement.

import type { FormValues } from "./types";

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

export type ConditionGroup = {
  connector: "and" | "or";
  conditions: Condition[];
};

const TOKEN = /\{([^}]+)\}\s*(>=|<=|==|!=|=|>|<|contains)\s*('[^']*'|"[^"]*"|[^\s]+)/gi;

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

// Evaluate an expression string against the current answers. An empty/blank
// expression is treated as "always true" (i.e. unconditional).
export function evaluateExpression(
  expression: string | undefined,
  values: FormValues,
): boolean {
  if (!expression || !expression.trim()) return true;

  const usesOr = /\bor\b/i.test(expression);
  const results: boolean[] = [];

  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(expression)) !== null) {
    const [, field, op, literal] = match;
    const left = values[field.trim()];
    const right = parseLiteral(literal);
    results.push(compare(normalize(left), op as ConditionOp, right));
  }

  if (results.length === 0) return true;
  return usesOr ? results.some(Boolean) : results.every(Boolean);
}

// Normalize a boolean stored as itself (our boolean field stores true/false).
function normalize(value: unknown): unknown {
  return value;
}

// ── Builder ⇄ string (used by the Logic tab) ──────────────────────────────

function quote(value: string): string {
  if (value === "true" || value === "false") return value;
  if (value !== "" && !Number.isNaN(Number(value))) return value;
  return `'${value.replace(/'/g, "")}'`;
}

// Serialize a group of conditions back into an expression string.
export function buildExpression(group: ConditionGroup): string {
  const parts = group.conditions
    .filter((c) => c.field)
    .map((c) => `{${c.field}} ${c.op} ${quote(c.value)}`);
  return parts.join(` ${group.connector} `);
}

// Parse an expression string into a group for editing. Falls back to an empty
// `and` group when the string is blank or unparseable.
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
