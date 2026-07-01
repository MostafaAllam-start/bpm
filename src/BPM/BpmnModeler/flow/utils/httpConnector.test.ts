import { describe, it, expect } from "vitest";
import {
  buildEvalContext,
  evaluateAllOutputRules,
  interpolate,
  parseHeaders,
  serializeHeaders,
  parseOutputRules,
  parseRequests,
} from "./httpConnector";
import type { HttpRequest } from "../types/index.ts";

const req = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
  id: "r1",
  name: "GetUsers",
  method: "GET",
  url: "https://api.example.com/users",
  headers: [],
  responsePath: "",
  isList: false,
  outputRules: [],
  ...overrides,
});

// ── buildEvalContext ──────────────────────────────────────────────────────────

describe("buildEvalContext — object response with responseVar", () => {
  const json = { status: "active", count: 5 };
  const ctx = buildEvalContext(
    [{ request: req({ responseVar: "getUsers" }), json }],
    {},
  );

  it("stores the full response under responseVar", () => {
    expect(ctx["getUsers"]).toEqual(json);
  });

  it("flattens top-level fields under responseVar.field", () => {
    expect(ctx["getUsers.status"]).toBe("active");
    expect(ctx["getUsers.count"]).toBe(5);
  });

  it("still flattens under requestName.field for backward compat", () => {
    expect(ctx["GetUsers.status"]).toBe("active");
  });

  it("adds legacy response.* prefix for the first request", () => {
    expect(ctx["response.status"]).toBe("active");
  });
});

describe("buildEvalContext — array response with responseVar", () => {
  const json = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
  const ctx = buildEvalContext(
    [{ request: req({ responseVar: "users", isList: true }), json }],
    {},
  );

  it("stores the full array under responseVar", () => {
    expect(ctx["users"]).toEqual(json);
  });

  it("adds .length key", () => {
    expect(ctx["users.length"]).toBe(2);
  });

  it("adds indexed item keys", () => {
    expect(ctx["users[0]"]).toEqual({ id: 1, name: "Alice" });
    expect(ctx["users[1]"]).toEqual({ id: 2, name: "Bob" });
  });

  it("adds indexed item field keys", () => {
    expect(ctx["users[0].id"]).toBe(1);
    expect(ctx["users[0].name"]).toBe("Alice");
    expect(ctx["users[1].name"]).toBe("Bob");
  });

  it("does NOT add requestName.* keys for arrays (only for plain objects)", () => {
    expect(ctx["GetUsers.length"]).toBeUndefined();
  });
});

describe("buildEvalContext — no responseVar", () => {
  it("still flattens requestName.* for plain objects", () => {
    const ctx = buildEvalContext(
      [{ request: req(), json: { x: 1 } }],
      {},
    );
    expect(ctx["GetUsers.x"]).toBe(1);
    expect(ctx["response.x"]).toBe(1);
  });
});

describe("buildEvalContext — processVars are included", () => {
  it("merges process variables into context", () => {
    const ctx = buildEvalContext([], { myVar: "hello" });
    expect(ctx["myVar"]).toBe("hello");
  });

  it("request data takes precedence over processVars for same key", () => {
    const ctx = buildEvalContext(
      [{ request: req({ responseVar: "r" }), json: { x: "fromRequest" } }],
      { "r.x": "fromProcess" },
    );
    expect(ctx["r.x"]).toBe("fromRequest");
  });
});

// ── evaluateAllOutputRules ────────────────────────────────────────────────────

describe("evaluateAllOutputRules — responseVar conditions", () => {
  const request = req({
    responseVar: "user",
    outputRules: [
      { id: "rule1", targetVar: "status", condition: "{user.active} = true", value: "active" },
      { id: "rule2", targetVar: "status", condition: "", value: "inactive" },
    ],
  });

  it("fires the first matching rule", () => {
    const result = evaluateAllOutputRules(
      [{ request, json: { active: true } }],
      {},
    );
    expect(result["status"]).toBe("active");
  });

  it("falls through to unconditioned rule when condition is false", () => {
    const result = evaluateAllOutputRules(
      [{ request, json: { active: false } }],
      {},
    );
    expect(result["status"]).toBe("inactive");
  });
});

describe("evaluateAllOutputRules — contains operator on array", () => {
  const request = req({
    responseVar: "roles",
    isList: true,
    outputRules: [
      { id: "rule1", targetVar: "isAdmin", condition: "{roles} contains 'admin'", value: "yes" },
    ],
  });

  it("matches when array contains the value", () => {
    const result = evaluateAllOutputRules(
      [{ request, json: ["admin", "editor"] }],
      {},
    );
    expect(result["isAdmin"]).toBe("yes");
  });

  it("does not match when array lacks the value", () => {
    const result = evaluateAllOutputRules(
      [{ request, json: ["editor"] }],
      {},
    );
    expect(result["isAdmin"]).toBeUndefined();
  });
});

describe("evaluateAllOutputRules — responseVar.field in value template", () => {
  it("resolves {responseVar.field} in the value template", () => {
    const request = req({
      responseVar: "user",
      outputRules: [
        { id: "rule1", targetVar: "userName", condition: "", value: "{user.name}" },
      ],
    });
    const result = evaluateAllOutputRules(
      [{ request, json: { name: "Alice", role: "admin" } }],
      {},
    );
    expect(result["userName"]).toBe("Alice");
  });
});

describe("evaluateAllOutputRules — length check on list", () => {
  it("fires when list is non-empty via .length condition", () => {
    const request = req({
      responseVar: "items",
      isList: true,
      outputRules: [
        { id: "r1", targetVar: "hasItems", condition: "{items.length} > 0", value: "true" },
      ],
    });
    const result = evaluateAllOutputRules(
      [{ request, json: [{ id: 1 }] }],
      {},
    );
    expect(result["hasItems"]).toBe("true");
  });
});

// ── interpolate ───────────────────────────────────────────────────────────────

describe("interpolate", () => {
  it("replaces known tokens with values from the store", () => {
    expect(interpolate("Hello {name}!", { name: "Alice" })).toBe("Hello Alice!");
  });

  it("leaves unknown tokens as-is", () => {
    expect(interpolate("Hello {unknown}!", {})).toBe("Hello {unknown}!");
  });

  it("handles multiple tokens", () => {
    expect(interpolate("{a} and {b}", { a: "1", b: "2" })).toBe("1 and 2");
  });

  it("handles null/undefined values by leaving the token", () => {
    expect(interpolate("{x}", { x: null })).toBe("{x}");
  });
});

// ── parseHeaders / serializeHeaders ──────────────────────────────────────────

describe("parseHeaders", () => {
  it("parses valid JSON array", () => {
    const raw = JSON.stringify([{ key: "Authorization", value: "Bearer token" }]);
    expect(parseHeaders(raw)).toEqual([{ key: "Authorization", value: "Bearer token" }]);
  });

  it("returns empty array for empty/malformed input", () => {
    expect(parseHeaders("")).toEqual([]);
    expect(parseHeaders("not-json")).toEqual([]);
    expect(parseHeaders(undefined)).toEqual([]);
  });
});

describe("serializeHeaders", () => {
  it("filters out blank headers", () => {
    const headers = [
      { key: "Authorization", value: "Bearer x" },
      { key: "", value: "" },
    ];
    const parsed = JSON.parse(serializeHeaders(headers)) as unknown[];
    expect(parsed).toHaveLength(1);
  });
});

// ── parseRequests ─────────────────────────────────────────────────────────────

describe("parseRequests", () => {
  it("parses a JSON array of requests", () => {
    const r = req({ responseVar: "myVar" });
    const raw = JSON.stringify([r]);
    expect(parseRequests(raw)).toEqual([r]);
  });

  it("migrates legacy flat props to a single request", () => {
    const requests = parseRequests(undefined, {
      httpMethod: "POST",
      httpUrl: "https://example.com",
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("https://example.com");
  });

  it("returns empty array when nothing is provided", () => {
    expect(parseRequests(undefined)).toEqual([]);
  });
});

// ── parseOutputRules ──────────────────────────────────────────────────────────

describe("parseOutputRules", () => {
  it("parses a valid JSON array", () => {
    const rule = { id: "r1", targetVar: "x", condition: "", value: "1" };
    expect(parseOutputRules(JSON.stringify([rule]))).toEqual([rule]);
  });

  it("returns empty array for empty/invalid input", () => {
    expect(parseOutputRules("")).toEqual([]);
    expect(parseOutputRules("bad")).toEqual([]);
    expect(parseOutputRules(undefined)).toEqual([]);
  });
});
