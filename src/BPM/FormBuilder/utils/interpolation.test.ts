import { describe, it, expect } from "vitest";

import { interpolate, tokensIn } from "./interpolation";

// Characterization tests for `{variable}` interpolation.

describe("interpolate", () => {
  it("replaces a token with its scope value", () => {
    expect(interpolate("Hi {name}", { name: "Sam" })).toBe("Hi Sam");
  });

  it("keeps an unresolved token literally by default", () => {
    expect(interpolate("{x}", {})).toBe("{x}");
    expect(interpolate("{x}", { x: null })).toBe("{x}");
  });

  it("blanks unresolved tokens when keepMissing is false", () => {
    expect(interpolate("{x}", {}, { keepMissing: false })).toBe("");
    expect(interpolate("{x}", { x: null }, { keepMissing: false })).toBe("");
  });

  it("joins array values with ', '", () => {
    expect(interpolate("{a}", { a: ["x", "y"] })).toBe("x, y");
  });

  it("renders objects as JSON", () => {
    expect(interpolate("{o}", { o: { a: 1 } })).toBe('{"a":1}');
  });

  it("supports dotted variable names", () => {
    expect(interpolate("{order.total}", { "order.total": 5 })).toBe("5");
  });

  it("returns '' for an empty template", () => {
    expect(interpolate(undefined, { a: 1 })).toBe("");
  });
});

describe("tokensIn", () => {
  it("returns distinct names in first-seen order", () => {
    expect(tokensIn("{a} {b} {a}")).toEqual(["a", "b"]);
  });
  it("returns [] for no tokens", () => {
    expect(tokensIn("plain text")).toEqual([]);
    expect(tokensIn(undefined)).toEqual([]);
  });
});
