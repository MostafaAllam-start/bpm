// Responsive (per-breakpoint) absolute layout. A field's `layout` is the BASE
// design (the `All` general design) — it applies to every screen by default.
// `field.responsive[bp]` overrides it for ONE breakpoint only: each screen is
// independent, so setting `md` affects md alone and never reaches any other
// breakpoint (larger or smaller). Screens with no override of their own fall back
// to the base. The designer edits one breakpoint at a time; the runtime resolves
// the right layout for the viewport.

import type { Breakpoint, FormField, FormSchema, LayoutBox } from "../types";

// Something that carries a base layout and optional per-breakpoint overrides —
// i.e. a FormField or the SubmitButton.
export type Positioned = {
  layout?: LayoutBox;
  responsive?: Partial<Record<Breakpoint, LayoutBox>>;
};

// Ordered smallest → largest. `minWidth` is the viewport/container width at which
// the band starts; `base` is the default design (the form's own canvas width is
// used for it, so it has no fixed minWidth band of its own).
export const RESPONSIVE_BREAKPOINTS: { key: Breakpoint; minWidth: number }[] = [
  { key: "base", minWidth: 0 },
  { key: "mobile", minWidth: 390 },
  { key: "sm", minWidth: 640 },
  { key: "md", minWidth: 768 },
  { key: "lg", minWidth: 1024 },
  { key: "xl", minWidth: 1280 },
  { key: "xxl", minWidth: 1536 },
];

// Breakpoint keys, base first.
export const BREAKPOINT_ORDER: Breakpoint[] = RESPONSIVE_BREAKPOINTS.map(
  (b) => b.key,
);

// The override breakpoints (everything except `base`, whose layout is `layout`).
export const OVERRIDE_BREAKPOINTS: Breakpoint[] = BREAKPOINT_ORDER.slice(1);

// The design/stage width for a breakpoint when editing or rendering it: the
// band's own minimum (so a layout authored there fits the whole band). `base`
// has no fixed width — callers pass the form's canvas width for it.
export function breakpointWidth(bp: Breakpoint, baseWidth: number): number {
  if (bp === "base") return baseWidth;
  return RESPONSIVE_BREAKPOINTS.find((b) => b.key === bp)?.minWidth ?? baseWidth;
}

// The breakpoint band a given width falls into (the largest whose minWidth ≤ w).
export function breakpointForWidth(width: number): Breakpoint {
  let match: Breakpoint = "base";
  for (const b of RESPONSIVE_BREAKPOINTS) {
    if (width >= b.minWidth) match = b.key;
  }
  return match;
}

// The effective layout for `bp`: that breakpoint's own override if it has one,
// else the base `layout` (the `All` general design). Each screen is independent —
// an override never reaches any other breakpoint, larger or smaller.
export function resolveLayout(
  item: Positioned | undefined,
  bp: Breakpoint,
): LayoutBox | undefined {
  if (!item) return undefined;
  if (bp !== "base") return item.responsive?.[bp] ?? item.layout;
  return item.layout;
}

// What `bp` would resolve to if it had no override of its own — i.e. the base
// `All` design every screen falls back to. Used to decide whether an edit at `bp`
// is a real override or just matches that fallback (in which case no override is
// stored, so the screen keeps using the general design).
export function inheritedLayout(
  item: Positioned,
  bp: Breakpoint,
): LayoutBox | undefined {
  if (bp === "base") return item.layout;
  const stripped: Partial<Record<Breakpoint, LayoutBox>> = {
    ...(item.responsive ?? {}),
  };
  delete stripped[bp];
  return resolveLayout({ layout: item.layout, responsive: stripped }, bp);
}

// Whether `bp` carries its own override (vs inheriting). `base` always "has" one.
export function hasOwnLayout(item: Positioned, bp: Breakpoint): boolean {
  return bp === "base" ? item.layout != null : item.responsive?.[bp] != null;
}

function boxesEqual(a: LayoutBox, b: LayoutBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.zIndex === b.zIndex &&
    a.widthUnit === b.widthUnit &&
    a.heightUnit === b.heightUnit
  );
}

// Return `item` with its layout for `bp` set to `box`. For `base` this writes
// `layout`; for an override breakpoint it writes `responsive[bp]` — but drops the
// override when it would just equal what the breakpoint already inherits, so we
// never store redundant overrides. `T` is preserved so the original field/submit
// shape (and its extra props) round-trips.
export function setLayoutAt<T extends Positioned>(
  item: T,
  bp: Breakpoint,
  box: LayoutBox,
): T {
  if (bp === "base") return { ...item, layout: box };
  const inherited = inheritedLayout(item, bp);
  const responsive: Partial<Record<Breakpoint, LayoutBox>> = {
    ...(item.responsive ?? {}),
  };
  if (inherited && boxesEqual(inherited, box)) delete responsive[bp];
  else responsive[bp] = box;
  const hasAny = Object.keys(responsive).length > 0;
  return { ...item, responsive: hasAny ? responsive : undefined };
}

// A single element's resolved box at one breakpoint, ready to serialize. `box`
// is what the runtime renders for that screen; `overridden` flags whether this
// breakpoint carries its own override (vs inheriting from a smaller one).
export type ResolvedElementLayout = {
  box: LayoutBox | null;
  overridden: boolean;
};

// Every positioned element (title, fields, submit) resolved at one breakpoint.
export type ResolvedBreakpointLayout = {
  breakpoint: Breakpoint;
  // The width (px) at which this band's design is laid out — the form's canvas
  // width for `base`, else the band's own minimum width.
  stageWidth: number;
  title: ResolvedElementLayout;
  fields: ({
    id: string | null;
    name: string;
    type: FormField["type"];
  } & ResolvedElementLayout)[];
  submit: ResolvedElementLayout;
};

function resolveElement(
  item: Positioned | undefined,
  bp: Breakpoint,
): ResolvedElementLayout {
  return {
    box: resolveLayout(item, bp) ?? null,
    overridden: item ? hasOwnLayout(item, bp) : false,
  };
}

// Resolve the absolute layout (position + dimensions) of every element in a form
// at every supported screen size. The form schema stores only a BASE `layout`
// plus the breakpoint overrides the designer actually customized; this expands
// that into the concrete box each element renders at for each breakpoint, so a
// consumer of the exported details doesn't have to reimplement the mobile-first
// cascade. Returns one entry per breakpoint (base → xxl).
export function resolveFormLayouts(schema: FormSchema): ResolvedBreakpointLayout[] {
  const baseWidth = schema.canvas?.width ?? 0;
  const fields = schema.pages.flatMap((page) => page.elements);
  return BREAKPOINT_ORDER.map((bp) => ({
    breakpoint: bp,
    stageWidth: breakpointWidth(bp, baseWidth),
    title: resolveElement(schema.titleBox, bp),
    fields: fields.map((field) => ({
      id: field.id ?? null,
      name: field.name,
      type: field.type,
      ...resolveElement(field, bp),
    })),
    submit: resolveElement(schema.submit, bp),
  }));
}

// Remove `bp`'s override so it goes back to inheriting (no-op for `base`).
export function clearLayoutAt<T extends Positioned>(item: T, bp: Breakpoint): T {
  if (bp === "base" || !item.responsive?.[bp]) return item;
  const responsive = { ...item.responsive };
  delete responsive[bp];
  return {
    ...item,
    responsive: Object.keys(responsive).length ? responsive : undefined,
  };
}
