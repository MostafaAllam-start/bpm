import { describe, it, expect } from "vitest";

import {
  buildExpression,
  evaluateExpression,
  parseExpression,
  type ConditionGroup,
} from "./conditions";

// Characterization tests — pin the current behavior of the condition grammar so
// later refactors can't change it silently.

describe("evaluateExpression", () => {
  it("compares a field against a numeric literal", () => {
    expect(evaluateExpression("{age} >= 18", { age: 20 })).toBe(true);
    expect(evaluateExpression("{age} >= 18", { age: 10 })).toBe(false);
  });

  it("ANDs comparisons by default", () => {
    expect(
      evaluateExpression("{a} = 'x' and {b} = true", { a: "x", b: true }),
    ).toBe(true);
    expect(
      evaluateExpression("{a} = 'x' and {b} = true", { a: "x", b: false }),
    ).toBe(false);
  });

  it("ORs comparisons when the expression uses `or`", () => {
    expect(evaluateExpression("{a} = 1 or {b} = 1", { a: 0, b: 1 })).toBe(true);
    expect(evaluateExpression("{a} = 1 or {b} = 1", { a: 0, b: 0 })).toBe(false);
  });

  it("treats an empty/undefined expression as unconditional (true)", () => {
    expect(evaluateExpression("", {})).toBe(true);
    expect(evaluateExpression(undefined, {})).toBe(true);
  });

  it("resolves a {ref} right-hand operand to another field's value", () => {
    expect(
      evaluateExpression("{requestedDays} <= {maxLeaveDays}", {
        requestedDays: 3,
        maxLeaveDays: 5,
      }),
    ).toBe(true);
    expect(
      evaluateExpression("{requestedDays} <= {maxLeaveDays}", {
        requestedDays: 9,
        maxLeaveDays: 5,
      }),
    ).toBe(false);
  });

  it("supports `contains` over strings and arrays", () => {
    expect(evaluateExpression("{role} contains 'admin'", { role: "superadmin" })).toBe(true);
    expect(evaluateExpression("{roles} contains 'admin'", { roles: ["user", "admin"] })).toBe(true);
    expect(evaluateExpression("{roles} contains 'admin'", { roles: ["user"] })).toBe(false);
  });
});

describe("parseExpression", () => {
  it("parses connector + conditions", () => {
    expect(parseExpression("{x} contains 'a' or {y} != 2")).toEqual<ConditionGroup>({
      connector: "or",
      conditions: [
        { field: "x", op: "contains", value: "a" },
        { field: "y", op: "!=", value: "2" },
      ],
    });
  });

  it("returns an empty `and` group for blank input", () => {
    expect(parseExpression("")).toEqual<ConditionGroup>({ connector: "and", conditions: [] });
    expect(parseExpression(undefined)).toEqual<ConditionGroup>({ connector: "and", conditions: [] });
  });
});

describe("buildExpression / round-trip", () => {
  it("serializes a group, quoting only strings", () => {
    expect(
      buildExpression({ connector: "and", conditions: [{ field: "age", op: ">=", value: "18" }] }),
    ).toBe("{age} >= 18");
    expect(
      buildExpression({ connector: "or", conditions: [{ field: "role", op: "contains", value: "admin" }] }),
    ).toBe("{role} contains 'admin'");
  });

  it("round-trips parse(build(x))", () => {
    const group: ConditionGroup = {
      connector: "and",
      conditions: [
        { field: "age", op: ">=", value: "18" },
        { field: "country", op: "=", value: "EG" },
      ],
    };
    expect(parseExpression(buildExpression(group))).toEqual(group);
  });
});
