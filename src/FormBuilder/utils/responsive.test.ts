import { describe, it, expect } from "vitest";

import {
  BREAKPOINT_ORDER,
  breakpointForWidth,
  breakpointWidth,
  clearLayoutAt,
  hasOwnLayout,
  resolveFormLayouts,
  resolveLayout,
  setLayoutAt,
  type Positioned,
} from "./responsive";
import type { FormSchema, LayoutBox } from "../types";

const box = (over: Partial<LayoutBox> = {}): LayoutBox => ({
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  zIndex: 1,
  ...over,
});

describe("breakpointForWidth", () => {
  it("returns the largest band whose minWidth <= width", () => {
    expect(breakpointForWidth(800)).toBe("tablet");
    expect(breakpointForWidth(390)).toBe("mobile");
    expect(breakpointForWidth(1100)).toBe("desktop");
  });
  it("returns base for 0", () => {
    expect(breakpointForWidth(0)).toBe("base");
  });
});

describe("resolveLayout", () => {
  const item: Positioned = { layout: box(), responsive: { tablet: box({ x: 99 }) } };

  it("uses a breakpoint's own override", () => {
    expect(resolveLayout(item, "tablet")).toEqual(box({ x: 99 }));
  });
  it("falls back to the base layout for breakpoints without an override", () => {
    expect(resolveLayout(item, "desktop")).toEqual(box());
  });
  it("returns the base layout for base", () => {
    expect(resolveLayout(item, "base")).toEqual(box());
  });
});

describe("setLayoutAt", () => {
  const item: Positioned = { layout: box() };

  it("stores an override that differs from the inherited base", () => {
    const next = setLayoutAt(item, "tablet", box({ x: 10 }));
    expect(next.responsive?.tablet).toEqual(box({ x: 10 }));
  });

  it("drops an override equal to what the breakpoint already inherits", () => {
    const next = setLayoutAt(item, "tablet", box());
    expect(next.responsive).toBeUndefined();
  });

  it("writes the base layout for base", () => {
    const next = setLayoutAt(item, "base", box({ y: 5 }));
    expect(next.layout).toEqual(box({ y: 5 }));
  });
});

describe("hasOwnLayout / clearLayoutAt", () => {
  const item: Positioned = { layout: box(), responsive: { tablet: box({ x: 7 }) } };

  it("reports own overrides", () => {
    expect(hasOwnLayout(item, "tablet")).toBe(true);
    expect(hasOwnLayout(item, "desktop")).toBe(false);
    expect(hasOwnLayout(item, "base")).toBe(true);
  });

  it("clears an override, leaving base untouched; base clear is a no-op", () => {
    expect(clearLayoutAt(item, "tablet").responsive).toBeUndefined();
    expect(clearLayoutAt(item, "base")).toBe(item);
  });
});

describe("resolveFormLayouts", () => {
  const schema: FormSchema = {
    pages: [{ name: "p", elements: [] }],
    canvas: { width: 960, height: 720 },
  };

  it("returns one entry per breakpoint with the right stage width", () => {
    const layouts = resolveFormLayouts(schema);
    expect(layouts).toHaveLength(BREAKPOINT_ORDER.length);
    expect(layouts[0].breakpoint).toBe("base");
    expect(layouts[0].stageWidth).toBe(960);
    const tablet = layouts.find((l) => l.breakpoint === "tablet");
    expect(tablet?.stageWidth).toBe(breakpointWidth("tablet", 960));
    expect(tablet?.stageWidth).toBe(768);
  });
});
