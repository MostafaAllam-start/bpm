import type { LayoutBox } from "../../types";
import {
  clampBox,
  clampMembersToGroups,
  DEFAULT_CANVAS_WIDTH,
  fieldsInBox,
  MIN_DIVIDER_HEIGHT,
  MIN_HEIGHT,
  normalizeGroups,
  packRows,
  PAGE_PADDING,
  rectsIntersect,
  reflowAbove,
  reflowBelow,
  reflowLeft,
  reflowRight,
  snapBox,
} from "../canvasLayout";
import { firstPage, gapsOf, mapElements } from "./schemaUtils";
import { SUBMIT_NAME, TITLE_NAME, type DesignerState, type GetFn, type SetFn } from "./types";
import type { StoreHelpers } from "./storeHelpers";

type LayoutActions = Pick<
  DesignerState,
  "updateLayout" | "moveSelectedTo" | "resizeField" | "nudgeSelected" | "bringToFront" | "sendToBack"
>;

export function createLayoutSlice(
  set: SetFn,
  get: GetFn,
  { itemLayout, setItemLayout, mapItemLayouts, zRange, commit, live }: StoreHelpers,
): LayoutActions {
  return {
    updateLayout: (name, patch) => {
      const { schema } = get();
      const cur = itemLayout(schema, name);
      if (!cur) return;
      const fieldType = schema.pages[0]?.elements.find((e) => e.name === name)?.type;
      const minH = fieldType === "divider" ? MIN_DIVIDER_HEIGHT : MIN_HEIGHT;
      commit(
        setItemLayout(schema, name, clampBox({ ...cur, ...patch }, minH)),
        `layout:${name}`,
      );
    },

    moveSelectedTo: (primary, pos) => {
      const { schema, selection, _baseline, activeBreakpoint } = get();
      const baseSchema = _baseline?.schema ?? schema;
      const baseEls = firstPage(baseSchema).elements;
      const selected = selection.includes(primary) ? selection : [primary];

      // Designing a specific breakpoint: a plain free move writing to this breakpoint's override.
      if (activeBreakpoint !== "base") {
        const moving = new Set(selected);
        for (const nm of selected) {
          const g = baseEls.find((e) => e.name === nm);
          if (g?.type === "group" && g.layout) {
            for (const m of fieldsInBox(baseEls, g.layout, nm)) moving.add(m);
          }
        }
        const lead = itemLayout(schema, primary);
        if (!lead) return;
        const dx = pos.x - lead.x;
        const dy = pos.y - lead.y;
        if (dx === 0 && dy === 0) return;
        live(
          mapItemLayouts(schema, moving, (l) => ({
            ...l,
            x: Math.max(0, Math.round(l.x + dx)),
            y: Math.max(0, Math.round(l.y + dy)),
          })),
        );
        return;
      }

      // Expand any group in the moving set to also carry the fields inside it.
      const movingSet = new Set(selected);
      for (const nm of selected) {
        const g = baseEls.find((e) => e.name === nm);
        if (g?.type === "group" && g.layout) {
          for (const m of fieldsInBox(baseEls, g.layout, nm)) movingSet.add(m);
        }
      }
      const moving = [...movingSet];
      const primaryIsGroup =
        baseEls.find((e) => e.name === primary)?.type === "group";

      // Multi-selection, a section box, the submit button, or the title: free delta move.
      if (
        moving.length > 1 ||
        primary === SUBMIT_NAME ||
        primary === TITLE_NAME ||
        primaryIsGroup
      ) {
        const lead = itemLayout(schema, primary);
        if (!lead) return;
        const dx = pos.x - lead.x;
        const dy = pos.y - lead.y;
        if (dx === 0 && dy === 0) return;
        live(
          mapItemLayouts(schema, new Set(moving), (l) => ({
            ...l,
            x: Math.max(0, Math.round(l.x + dx)),
            y: Math.max(0, Math.round(l.y + dy)),
          })),
        );
        return;
      }

      // Single field: free move with overlap detection → row-flow on overlap.
      const cur = get();
      const base = cur._baseline?.schema ?? schema;
      const aBase = firstPage(base).elements.find((e) => e.name === primary);
      if (!aBase?.layout) return;
      const aLayout = aBase.layout;
      const { x: gapX, y: gapY } = gapsOf(schema);
      const canvasWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
      const left = PAGE_PADDING;
      const right = canvasWidth - PAGE_PADDING;

      const baseElements = firstPage(base).elements;
      const others = baseElements
        .filter((e) => e.name !== primary && e.layout && e.type !== "group")
        .map((e) => ({ name: e.name, layout: e.layout as LayoutBox }))
        .sort((p, q) => p.layout.y - q.layout.y || p.layout.x - q.layout.x);

      const maxX = Math.max(left, right - aLayout.width);
      const movedA: LayoutBox = {
        ...aLayout,
        x: Math.min(maxX, Math.max(left, Math.round(pos.x))),
        y: Math.max(PAGE_PADDING, Math.round(pos.y)),
      };

      const page = firstPage(schema);

      // Free placement: no overlap → field rests where dropped.
      if (!others.some((o) => rectsIntersect(movedA, o.layout))) {
        const baseByName = new Map(baseElements.map((e) => [e.name, e.layout]));
        const elements = page.elements.map((e) => {
          if (e.name === primary) return { ...e, layout: movedA };
          const homeBox = baseByName.get(e.name);
          return homeBox ? { ...e, layout: homeBox } : e;
        });
        set({
          schema: {
            ...schema,
            pages: [{ ...page, elements }, ...schema.pages.slice(1)],
          },
          _dragName: primary,
          _dragHome: movedA,
        });
        return;
      }

      // Overlap → re-flow into rows so nothing overlaps.
      const top = others.reduce((m, o) => Math.min(m, o.layout.y), aLayout.y);
      const cx = movedA.x + movedA.width / 2;
      const cy = movedA.y + movedA.height / 2;
      const solo = packRows(others, left, right, top, gapX, gapY);
      let idx = 0;
      for (const o of others) {
        const p = solo.get(o.name)!;
        const slotCx = p.x + o.layout.width / 2;
        const before =
          cy < p.y ? false : cy > p.y + o.layout.height ? true : slotCx < cx;
        if (before) idx += 1;
      }
      const order = [
        ...others.slice(0, idx),
        { name: primary, layout: aLayout },
        ...others.slice(idx),
      ];
      const packed = packRows(order, left, right, top, gapX, gapY);
      const slot = packed.get(primary);
      const home: LayoutBox = slot ? { ...aLayout, ...slot } : movedA;

      const elements = page.elements.map((e) => {
        if (e.name === primary) return { ...e, layout: movedA };
        const p = packed.get(e.name);
        return e.layout && p ? { ...e, layout: { ...e.layout, ...p } } : e;
      });
      set({
        schema: {
          ...schema,
          pages: [{ ...page, elements }, ...schema.pages.slice(1)],
        },
        _dragName: primary,
        _dragHome: home,
      });
    },

    resizeField: (name, box) => {
      const { schema, snap, gridSize, _baseline, activeBreakpoint } = get();
      const fieldType = schema.pages[0]?.elements.find((e) => e.name === name)?.type;
      const minH = fieldType === "divider" ? MIN_DIVIDER_HEIGHT : MIN_HEIGHT;
      const next = snap ? snapBox(clampBox(box, minH), gridSize) : clampBox(box, minH);

      // The title banner resizes freely without reflowing neighbours.
      if (name === TITLE_NAME) {
        live(setItemLayout(schema, name, next));
        return;
      }

      // Designing a specific breakpoint: just set this item's size for that breakpoint.
      if (activeBreakpoint !== "base") {
        live(setItemLayout(schema, name, next));
        return;
      }

      // Resizing a section box only changes the box; clamp members to stay inside.
      if (firstPage(schema).elements.find((e) => e.name === name)?.type === "group") {
        live(
          mapElements(setItemLayout(schema, name, next), (els) =>
            clampMembersToGroups(els),
          ),
        );
        return;
      }

      // Reflow neighbours of the resized field so it never overlaps them.
      const base = _baseline?.schema ?? schema;
      const baseFields = firstPage(base).elements;
      const items: { name: string; layout: LayoutBox }[] = [];
      for (const e of baseFields) {
        if (e.layout) {
          items.push({ name: e.name, layout: e.name === name ? next : e.layout });
        }
      }
      if (base.submit?.layout) {
        items.push({
          name: SUBMIT_NAME,
          layout: name === SUBMIT_NAME ? next : base.submit.layout,
        });
      }
      const { x: gapX, y: gapY } = gapsOf(schema);
      const a0 =
        (name === SUBMIT_NAME
          ? base.submit?.layout
          : baseFields.find((e) => e.name === name)?.layout) ?? next;
      const anchorItem = items.find((it) => it.name === name)!;
      // Section boxes are excluded from reflow candidates (they overlap their contents by design).
      const groupNames = new Set(
        baseFields.filter((e) => e.type === "group").map((e) => e.name),
      );
      const xShare = (b: LayoutBox) => b.x < a0.x + a0.width && b.x + b.width > a0.x;
      const yShare = (b: LayoutBox) => b.y < a0.y + a0.height && b.y + b.height > a0.y;
      const colItems = [
        anchorItem,
        ...items.filter(
          (it) => it.name !== name && !groupNames.has(it.name) && xShare(it.layout),
        ),
      ];
      const rowItems = [
        anchorItem,
        ...items.filter(
          (it) => it.name !== name && !groupNames.has(it.name) && yShare(it.layout),
        ),
      ];
      const moved = new Map([
        ...reflowAbove(colItems, name, gapY),
        ...reflowBelow(colItems, name, gapY),
        ...reflowLeft(rowItems, name, gapX),
        ...reflowRight(rowItems, name, gapX),
      ]);

      const page = firstPage(schema);
      const baseByName = new Map(baseFields.map((e) => [e.name, e.layout]));
      const elements = page.elements.map((e) => {
        if (!e.layout) return e;
        if (e.name === name) return { ...e, layout: next };
        const pushed = moved.get(e.name);
        if (pushed) return { ...e, layout: pushed };
        const home = baseByName.get(e.name);
        return home ? { ...e, layout: home } : e;
      });
      let submit = schema.submit;
      if (schema.submit) {
        const layout =
          name === SUBMIT_NAME
            ? next
            : moved.get(SUBMIT_NAME) ?? base.submit?.layout ?? schema.submit.layout;
        submit = { ...schema.submit, layout };
      }

      live({
        ...schema,
        pages: [
          { ...page, elements: normalizeGroups(elements, schema.canvas?.width) },
          ...schema.pages.slice(1),
        ],
        submit,
      });
    },

    nudgeSelected: (dx, dy) => {
      const { schema, selection } = get();
      if (selection.length === 0) return;
      commit(
        mapItemLayouts(schema, new Set(selection), (l) => ({
          ...l,
          x: Math.max(0, l.x + dx),
          y: Math.max(0, l.y + dy),
        })),
        "nudge",
      );
    },

    bringToFront: () => {
      const { schema, selection } = get();
      if (selection.length === 0) return;
      let z = zRange(schema).max;
      commit(
        mapItemLayouts(schema, new Set(selection), (l) => ({
          ...l,
          zIndex: (z += 1),
        })),
      );
    },

    sendToBack: () => {
      const { schema, selection } = get();
      if (selection.length === 0) return;
      let z = zRange(schema).min;
      commit(
        mapItemLayouts(schema, new Set(selection), (l) => ({
          ...l,
          zIndex: (z -= 1),
        })),
      );
    },
  };
}
