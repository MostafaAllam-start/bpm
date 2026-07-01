// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

import TableInlineEditor from "./TableInlineEditor.tsx";
import { DesignerStoreProvider, createDesignerStore } from "./designerStore";
import { insertColumn } from "./tableOps.ts";
import type { FormField, FormSchema } from "../types.ts";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;
if (!document.execCommand) {
  (document as unknown as { execCommand: () => boolean }).execCommand = () =>
    true;
}

afterEach(cleanup);

function tableField(): FormField {
  return {
    name: "t1",
    type: "table",
    tableColumns: [{ default: "A" }, { default: "B" }],
    tableRows: [[{ default: "a1" }, { default: "b1" }]],
  };
}

function schemaWith(field: FormField): FormSchema {
  return {
    pages: [{ name: "page1", elements: [field] }],
  };
}

function headerCells(container: HTMLElement): HTMLElement[] {
  const thead = container.querySelector("thead");
  return thead ? Array.from(thead.querySelectorAll("th")) : [];
}

// Insert a column at `at`, render the editor, double-click the inserted header
// cell (visually the `expectIndex`-th non-covered <th>) and report whether it
// entered edit mode.
function canEditInsertedHeader(
  field0: FormField,
  at: number,
  expectHeaderIndex: number,
): boolean {
  const store = createDesignerStore(schemaWith(field0));
  const seed = store.getState().schema.pages[0].elements[0];
  store.getState().updateField("t1", insertColumn(seed, at));
  const field = store.getState().schema.pages[0].elements[0];

  const { container, rerender } = render(
    <DesignerStoreProvider value={store}>
      <TableInlineEditor field={field} editingLocale="en" primaryLang="en" />
    </DesignerStoreProvider>,
  );
  const ths = headerCells(container);
  const target = ths[expectHeaderIndex];
  if (!target) return false;
  fireEvent.pointerDown(target, { button: 0 });
  fireEvent.doubleClick(target);
  const latest = store.getState().schema.pages[0].elements[0];
  rerender(
    <DesignerStoreProvider value={store}>
      <TableInlineEditor field={latest} editingLocale="en" primaryLang="en" />
    </DesignerStoreProvider>,
  );
  return container.querySelector('thead th[contenteditable="true"]') !== null;
}

describe("inserted-column header editing", () => {
  it("edits a header inserted in the middle", () => {
    expect(canEditInsertedHeader(tableField(), 1, 1)).toBe(true);
  });

  it("edits a header inserted before the first column", () => {
    expect(canEditInsertedHeader(tableField(), 0, 0)).toBe(true);
  });

  it("edits a header inserted after the last column", () => {
    expect(canEditInsertedHeader(tableField(), 2, 2)).toBe(true);
  });

  it("commits typed text to the inserted header column (no off-by-one)", () => {
    const store = createDesignerStore(schemaWith(tableField()));
    const seed = store.getState().schema.pages[0].elements[0];
    store.getState().updateField("t1", insertColumn(seed, 1));
    let field = store.getState().schema.pages[0].elements[0];

    const view = render(
      <DesignerStoreProvider value={store}>
        <TableInlineEditor field={field} editingLocale="en" primaryLang="en" />
      </DesignerStoreProvider>,
    );
    const th = headerCells(view.container)[1];
    fireEvent.pointerDown(th, { button: 0 });
    fireEvent.doubleClick(th);
    field = store.getState().schema.pages[0].elements[0];
    view.rerender(
      <DesignerStoreProvider value={store}>
        <TableInlineEditor field={field} editingLocale="en" primaryLang="en" />
      </DesignerStoreProvider>,
    );
    const editable = view.container.querySelector<HTMLElement>(
      'thead th[contenteditable="true"]',
    )!;
    editable.innerHTML = "NEW";
    fireEvent.blur(editable);

    const cols = store.getState().schema.pages[0].elements[0]
      .tableColumns as { default?: string; en?: string }[];
    const texts = cols.map((c) => c.en ?? c.default ?? "");
    expect(texts).toEqual(["A", "NEW", "B"]);
  });

  it("edits a header inserted next to a merged header cell", () => {
    // Header cell 0 spans two columns; insert a column at the right edge of the
    // span. The new column must be a real, editable cell — not swallowed by the
    // merge.
    const merged = {
      ...tableField(),
      tableColumns: [{ default: "A" }, { default: "B" }, { default: "C" }],
      tableRows: [[{ default: "a" }, { default: "b" }, { default: "c" }]],
      tableCellStyles: { "h:0:0": { colSpan: 2 } },
    } as FormField;
    // After inserting at 2, the header cells shown are: [merged A(span2), new, C]
    expect(canEditInsertedHeader(merged, 2, 1)).toBe(true);
  });
});
