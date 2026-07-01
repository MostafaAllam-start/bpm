import { describe, it, expect } from "vitest";

import { colToPx, cssDim, pxToCol, pxToUnit, unitToPx } from "./units";

// Characterization tests for the unit conversion helpers.

describe("pxToCol", () => {
  it("rounds a px width to a whole column span", () => {
    expect(pxToCol(300, 600, 12)).toBe(6);
  });
  it("clamps to [1, columns]", () => {
    expect(pxToCol(10000, 600, 12)).toBe(12);
    expect(pxToCol(1, 600, 12)).toBe(1);
  });
  it("returns the column count when innerWidth <= 0", () => {
    expect(pxToCol(300, 0, 12)).toBe(12);
  });
});

describe("colToPx", () => {
  it("converts a span to px", () => {
    expect(colToPx(6, 600, 12)).toBe(300);
  });
  it("clamps the span to the column count (never overflows)", () => {
    expect(colToPx(99, 600, 12)).toBe(600);
  });
});

describe("pxToUnit", () => {
  it("converts px to rem at 16px root", () => {
    expect(pxToUnit(96, "rem", 0)).toBe(6);
  });
  it("converts px to % of the reference length", () => {
    expect(pxToUnit(150, "%", 600)).toBe(25);
  });
  it("rounds px to an integer, others to 2dp", () => {
    expect(pxToUnit(150.6, "px", 0)).toBe(151);
    expect(pxToUnit(200, "%", 600)).toBeCloseTo(33.33, 2);
  });
});

describe("unitToPx", () => {
  it("converts a % back to px", () => {
    expect(unitToPx(50, "%", 600)).toBe(300);
  });
  it("round-trips with pxToUnit", () => {
    expect(unitToPx(pxToUnit(240, "%", 600), "%", 600)).toBe(240);
  });
});

describe("cssDim", () => {
  it("emits a percentage", () => {
    expect(cssDim(150, "%", 600)).toBe("25%");
  });
  it("emits px", () => {
    expect(cssDim(240, "px", 0)).toBe("240px");
  });
  it("emits a `col` width as a percentage of the reference", () => {
    expect(cssDim(300, "col", 600)).toBe("50%");
  });
  it("defaults to % when no unit is given", () => {
    expect(cssDim(150, undefined, 600)).toBe("25%");
  });
});
