import type { FormField, FormPage, FormSchema, LayoutBox } from "../../types";
import {
  clampColumns,
  DEFAULT_CANVAS_WIDTH,
  defaultSubmitLayout,
  defaultTitleLayout,
  ensureLayout,
  FIELD_GAP,
} from "../canvasLayout";
import { ensureFieldIds } from "../ids";

export function firstPage(schema: FormSchema, pageIndex = 0): FormPage {
  return schema.pages[pageIndex] ?? schema.pages[0] ?? { name: "page1", elements: [] };
}

export function replacePage(
  schema: FormSchema,
  pageIndex: number,
  updater: (page: FormPage) => FormPage,
): FormSchema {
  const pages = schema.pages.map((p, i) => (i === pageIndex ? updater(p) : p));
  return { ...schema, pages };
}

export function allFields(schema: FormSchema): FormField[] {
  return schema.pages.flatMap((page) => page.elements);
}

export function gapsOf(schema: FormSchema): { x: number; y: number } {
  return {
    x: schema.canvas?.gapX ?? FIELD_GAP,
    y: schema.canvas?.gapY ?? FIELD_GAP,
  };
}

export function mapElements(
  schema: FormSchema,
  updater: (elements: FormField[]) => FormField[],
  pageIndex = 0,
): FormSchema {
  const page = firstPage(schema, pageIndex);
  return {
    ...schema,
    pages: schema.pages.map((p, i) =>
      i === pageIndex ? { ...page, elements: updater(page.elements) } : p,
    ),
  };
}

function ensureSubmit(schema: FormSchema): FormSchema {
  if (schema.submit?.layout) return schema;
  const fields = firstPage(schema).elements;
  const canvasWidth = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
  return { ...schema, submit: { layout: defaultSubmitLayout(fields, canvasWidth) } };
}

function ensureTitle(schema: FormSchema): FormSchema {
  if (schema.titleBox?.layout) return schema;
  const width = schema.canvas?.width ?? DEFAULT_CANVAS_WIDTH;
  const box = defaultTitleLayout(width);
  const shift = box.height + FIELD_GAP;
  const shiftDown = (l: LayoutBox): LayoutBox => ({ ...l, y: l.y + shift });
  const page = firstPage(schema);
  return {
    ...schema,
    pages: [
      {
        ...page,
        elements: page.elements.map((e) =>
          e.layout ? { ...e, layout: shiftDown(e.layout) } : e,
        ),
      },
      ...schema.pages.slice(1),
    ],
    submit: schema.submit?.layout
      ? { ...schema.submit, layout: shiftDown(schema.submit.layout) }
      : schema.submit,
    titleBox: { layout: box },
  };
}

export function normalize(schema: FormSchema): FormSchema {
  const withIds = ensureFieldIds(schema);
  const withLayout = ensureLayout(withIds);
  const canvas = withLayout.canvas ?? { width: DEFAULT_CANVAS_WIDTH, height: 720 };
  return ensureTitle(
    ensureSubmit({
      ...withLayout,
      canvas: {
        ...canvas,
        autoWidth: canvas.autoWidth ?? true,
        gapX: canvas.gapX ?? FIELD_GAP,
        gapY: canvas.gapY ?? FIELD_GAP,
        columns: clampColumns(canvas.columns),
      },
    }),
  );
}
