import { evaluateExpression, getByPath, resolveFetchUrl } from "@FormBuilder";
import type { HttpOutputRule, HttpRequest, HttpHeader } from "../types/index.ts";

// Pure helpers for the HTTP Connector Task: config serialisation, response
// fetching, and output-rule evaluation. Shared by the properties panel and the
// simulation HTTP panel so the two never diverge.

// Re-export HttpHeader so existing consumers (HeadersEditor) can keep their import path.
export type { HttpHeader };

// ── Serialisation ────────────────────────────────────────────────────────────

export function parseHeaders(raw?: string): HttpHeader[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as HttpHeader[];
  } catch {
    // malformed — treat as empty
  }
  return [];
}

export function serializeHeaders(headers: HttpHeader[]): string {
  return JSON.stringify(headers.filter((h) => h.key.trim() || h.value.trim()));
}

export function parseOutputRules(raw?: string): HttpOutputRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as HttpOutputRule[];
  } catch {
    // malformed — treat as empty
  }
  return [];
}

export function serializeOutputRules(rules: HttpOutputRule[]): string {
  return JSON.stringify(rules);
}

// Parse the httpRequests prop. Falls back to synthesising one request from the
// old flat props (httpMethod / httpUrl / …) so existing nodes keep working.
export function parseRequests(
  raw?: string,
  legacyProps?: Record<string, string>,
): HttpRequest[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as HttpRequest[];
    } catch {
      // fall through to legacy migration
    }
  }
  // Migrate from the old single-request flat props.
  if (legacyProps && (legacyProps.httpMethod || legacyProps.httpUrl)) {
    return [
      {
        id: crypto.randomUUID(),
        name: "Request 1",
        method: (legacyProps.httpMethod ?? "GET") as HttpRequest["method"],
        url: legacyProps.httpUrl ?? "",
        headers: parseHeaders(legacyProps.httpHeaders),
        body: legacyProps.httpBody,
        responsePath: legacyProps.httpResponsePath ?? "",
        isList: false,
        outputRules: parseOutputRules(legacyProps.httpOutputRules),
      },
    ];
  }
  return [];
}

export function serializeRequests(requests: HttpRequest[]): string {
  return JSON.stringify(requests);
}

// ── Variable interpolation ───────────────────────────────────────────────────

// Replace {varRef} tokens in a template string with values from the variable
// store. Unknown refs are left as-is so they are visible in the UI.
export function interpolate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, ref: string) => {
    const v = vars[ref.trim()];
    return v != null ? String(v) : match;
  });
}

// ── HTTP fetch ───────────────────────────────────────────────────────────────

export type FetchResult =
  | { ok: true; json: unknown; text: string }
  | { ok: false; error: string };

export async function fetchHttpConnector(
  method: string,
  url: string,
  headers: HttpHeader[],
  body: string,
): Promise<FetchResult> {
  try {
    const init: RequestInit = {
      method: method || "GET",
      headers: Object.fromEntries(headers.filter((h) => h.key).map((h) => [h.key, h.value])),
    };
    if (body && method !== "GET" && method !== "HEAD") {
      init.body = body;
    }
    const res = await fetch(resolveFetchUrl(url), init);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    let json: unknown = text;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      // not JSON — keep raw text
    }
    return { ok: true, json, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Output rule evaluation ───────────────────────────────────────────────────

// Build the variable evaluation context for a set of completed requests.
// Each request's response JSON is flattened under "{requestName}.{field}"
// so conditions like `{Request 1.status} = 'active'` resolve correctly.
export function buildEvalContext(
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
  processVars: Record<string, unknown>,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = { ...processVars };
  requestResults.forEach(({ request, json }, idx) => {
    // Store the full response under the user-defined responseVar, plus flat
    // sub-keys so {responseVar.field} / {responseVar.length} / {responseVar[0].field}
    // all resolve in evaluateExpression (which does flat ctx key lookup only).
    if (request.responseVar) {
      const rv = request.responseVar;
      ctx[rv] = json;
      if (Array.isArray(json)) {
        ctx[`${rv}.length`] = json.length;
        (json as unknown[]).slice(0, 50).forEach((item, i) => {
          ctx[`${rv}[${i}]`] = item;
          if (item && typeof item === "object") {
            for (const [k, v] of Object.entries(item as Record<string, unknown>))
              ctx[`${rv}[${i}].${k}`] = v;
          }
        });
      } else if (json && typeof json === "object") {
        for (const [k, v] of Object.entries(json as Record<string, unknown>))
          ctx[`${rv}.${k}`] = v;
      }
    }
    // Also flatten under request.name.* for backward compat (non-array objects only).
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const entries = Object.entries(json as Record<string, unknown>);
      for (const [k, v] of entries) {
        ctx[`${request.name}.${k}`] = v;
      }
      // Keep legacy `response.*` prefix for the first request so existing
      // output rules that use {response.field} keep working.
      if (idx === 0) {
        for (const [k, v] of entries) {
          ctx[`response.${k}`] = v;
        }
      }
    }
  });
  return ctx;
}

// ── Token resolution strategies (tried in order by resolveToken) ─────────────

// {responseVar} or {responseVar.field} — full response or path within it.
function resolveResponseVarToken(
  key: string,
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
): string | null {
  for (const { request, json } of requestResults) {
    const rv = request.responseVar;
    if (!rv) continue;
    if (key === rv) return json != null ? JSON.stringify(json) : null;
    if (key.startsWith(rv + ".")) {
      const v = getByPath(json, key.slice(rv.length + 1));
      return v != null ? String(v) : null;
    }
  }
  return null;
}

// {RequestName.field} — dot-path into a named request's response.
function resolveRequestNameToken(
  key: string,
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
): string | null {
  for (const { request, json } of requestResults) {
    const prefix = request.name + ".";
    if (key.startsWith(prefix)) {
      const v = getByPath(json, key.slice(prefix.length));
      return v != null ? String(v) : null;
    }
  }
  return null;
}

// Legacy {response.field} — first request only, kept for backward compat.
function resolveLegacyResponseToken(
  key: string,
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
): string | null {
  if (key.startsWith("response.") && requestResults.length > 0) {
    const v = getByPath(requestResults[0].json, key.slice("response.".length));
    return v != null ? String(v) : null;
  }
  return null;
}

// {varName} — process variable fallback.
function resolveProcessVarToken(
  key: string,
  processVars: Record<string, unknown>,
): string | null {
  const v = processVars[key];
  return v != null ? String(v) : null;
}

// Resolve a single `{key}` token against all available sources. Returns the
// matched string value, or `null` if no source resolves it (caller keeps the
// original `{key}` text).
function resolveToken(
  key: string,
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
  processVars: Record<string, unknown>,
): string | null {
  return (
    resolveResponseVarToken(key, requestResults) ??
    resolveRequestNameToken(key, requestResults) ??
    resolveLegacyResponseToken(key, requestResults) ??
    resolveProcessVarToken(key, processVars)
  );
}

// Replace every {token} in a template string using the resolution chain above.
function resolveValue(
  template: string,
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
  processVars: Record<string, unknown>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, ref: string) => {
    return resolveToken(ref.trim(), requestResults, processVars) ?? match;
  });
}

// Evaluate all output rules for every request. Returns the merged set of
// variables to write; first matching condition per target variable wins across
// all rules in all requests (processed in request order).
export function evaluateAllOutputRules(
  requestResults: Array<{ request: HttpRequest; json: unknown }>,
  processVars: Record<string, unknown>,
): Record<string, string> {
  const ctx = buildEvalContext(requestResults, processVars);
  const result: Record<string, string> = {};

  for (const { request } of requestResults) {
    for (const rule of request.outputRules) {
      if (!rule.targetVar) continue;
      if (rule.targetVar in result) continue; // already won by an earlier rule
      const matches = evaluateExpression(rule.condition || undefined, ctx);
      if (matches) {
        result[rule.targetVar] = resolveValue(rule.value, requestResults, processVars);
      }
    }
  }
  return result;
}

// Legacy single-request evaluator kept for backward compat with any code that
// hasn't migrated to evaluateAllOutputRules yet.
export function evaluateOutputRules(
  rules: HttpOutputRule[],
  responseData: unknown,
  processVars: Record<string, unknown>,
): Record<string, string> {
  const ctx: Record<string, unknown> = { ...processVars };
  if (responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
    for (const [k, v] of Object.entries(responseData as Record<string, unknown>)) {
      ctx[`response.${k}`] = v;
    }
  }
  const result: Record<string, string> = {};
  for (const rule of rules) {
    if (!rule.targetVar) continue;
    if (rule.targetVar in result) continue;
    const matches = evaluateExpression(rule.condition || undefined, ctx);
    if (matches) {
      result[rule.targetVar] = resolveValue(rule.value, [], processVars);
    }
  }
  return result;
}
