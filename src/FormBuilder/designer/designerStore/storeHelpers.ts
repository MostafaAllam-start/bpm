import type { FormSchema, LayoutBox } from "../../types";
import { resolveLayout, setLayoutAt } from "../../utils/responsive";
import { SUBMIT_NAME, TITLE_NAME, type GetFn, type SetFn } from "./types";
import { firstPage, mapElements } from "./schemaUtils";

export type StoreHelpers = {
  itemLayout: (schema: FormSchema, name: string) => LayoutBox | undefined;
  setItemLayout: (schema: FormSchema, name: string, layout: LayoutBox) => FormSchema;
  mapItemLayouts: (
    schema: FormSchema,
    names: Set<string>,
    fn: (layout: LayoutBox) => LayoutBox,
  ) => FormSchema;
  zRange: (schema: FormSchema) => { min: number; max: number };
  commit: (next: FormSchema, tag?: string) => void;
  live: (next: FormSchema) => void;
};

export function makeStoreHelpers(set: SetFn, get: GetFn): StoreHelpers {
  const itemLayout = (schema: FormSchema, name: string): LayoutBox | undefined => {
    const bp = get().activeBreakpoint;
    const item =
      name === SUBMIT_NAME
        ? schema.submit
        : name === TITLE_NAME
          ? schema.titleBox
          : firstPage(schema).elements.find((e) => e.name === name);
    return item ? resolveLayout(item, bp) : undefined;
  };

  const setItemLayout = (schema: FormSchema, name: string, layout: LayoutBox): FormSchema => {
    const bp = get().activeBreakpoint;
    if (name === SUBMIT_NAME) {
      return schema.submit
        ? { ...schema, submit: setLayoutAt(schema.submit, bp, layout) }
        : schema;
    }
    if (name === TITLE_NAME) {
      return schema.titleBox
        ? { ...schema, titleBox: setLayoutAt(schema.titleBox, bp, layout) }
        : schema;
    }
    return mapElements(schema, (els) =>
      els.map((e) => (e.name === name ? setLayoutAt(e, bp, layout) : e)),
    );
  };

  const mapItemLayouts = (
    schema: FormSchema,
    names: Set<string>,
    fn: (layout: LayoutBox) => LayoutBox,
  ): FormSchema => {
    const bp = get().activeBreakpoint;
    let next = mapElements(schema, (els) =>
      els.map((e) => {
        if (!names.has(e.name)) return e;
        const cur = resolveLayout(e, bp);
        return cur ? setLayoutAt(e, bp, fn(cur)) : e;
      }),
    );
    if (names.has(SUBMIT_NAME) && next.submit) {
      const cur = resolveLayout(next.submit, bp);
      if (cur) next = { ...next, submit: setLayoutAt(next.submit, bp, fn(cur)) };
    }
    if (names.has(TITLE_NAME) && next.titleBox) {
      const cur = resolveLayout(next.titleBox, bp);
      if (cur) next = { ...next, titleBox: setLayoutAt(next.titleBox, bp, fn(cur)) };
    }
    return next;
  };

  const zRange = (schema: FormSchema): { min: number; max: number } => {
    const bp = get().activeBreakpoint;
    const boxes = [
      ...firstPage(schema).elements.map((e) => resolveLayout(e, bp)),
      resolveLayout(schema.submit, bp),
      resolveLayout(schema.titleBox, bp),
    ];
    let min = Infinity;
    let max = 0;
    for (const b of boxes) {
      if (!b) continue;
      min = Math.min(min, b.zIndex);
      max = Math.max(max, b.zIndex);
    }
    return { min: min === Infinity ? 0 : min, max };
  };

  const commit = (next: FormSchema, tag?: string): void => {
    const { schema, selection, past, _coalesceTag } = get();
    if (next === schema) return;
    if (tag && tag === _coalesceTag) {
      set({ schema: next });
      return;
    }
    set({
      past: [...past, { schema, selection }],
      future: [],
      schema: next,
      _coalesceTag: tag ?? null,
    });
  };

  const live = (next: FormSchema): void => {
    if (next !== get().schema) set({ schema: next });
  };

  return { itemLayout, setItemLayout, mapItemLayouts, zRange, commit, live };
}
