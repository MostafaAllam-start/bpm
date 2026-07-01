import type { StoreApi } from "zustand/vanilla";
import type {
  Breakpoint,
  CanvasSettings,
  FieldType,
  FormField,
  FormSchema,
  FormTitle,
  LayoutBox,
  ThemeSettings,
} from "../../types";
import type { Rect } from "../canvasLayout";

export const PAGE_MARGIN = 40;
export const FIT_MARGIN = 16;
export const SUBMIT_NAME = "__submit__";
export const TITLE_NAME = "__title__";

export type ScreenPoint = { x: number; y: number };

export type AlignGuide = {
  axis: "x" | "y";
  position: number;
  type: "form-center" | "field-edge" | "field-center" | "section-edge" | "section-center";
};

export type HistoryEntry = { schema: FormSchema; selection: string[] };

export type DesignerState = {
  // ── document ──
  schema: FormSchema;
  // ── selection (field names; the last entry is the "primary") ──
  selection: string[];
  // ── viewport (size only — the canvas renders 1:1 and scrolls on overflow) ──
  viewport: { width: number; height: number };
  // ── grid ──
  snap: boolean;
  gridSize: number;
  // ── guideline overlays (view-only, not part of the schema) ──
  showColGuides: boolean;
  showRowGuides: boolean;
  // ── responsive: which breakpoint the canvas is currently designing ──
  activeBreakpoint: Breakpoint;
  // ── multi-page (pdf mode): index of the page currently being edited ──
  activePageIndex: number;
  // ── history ──
  past: HistoryEntry[];
  future: HistoryEntry[];
  _baseline: HistoryEntry | null;
  _coalesceTag: string | null;
  _dragName: string | null;
  _dragHome: LayoutBox | null;

  // ── document actions ──
  load: (schema: FormSchema) => void;
  addField: (
    type: FieldType,
    defaultTitle: string,
    at?: { x: number; y: number },
  ) => void;
  removeField: (name: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveField: (from: number, to: number) => void;
  updateField: (name: string, patch: Partial<FormField>) => void;
  renameField: (name: string, next: string) => boolean;
  updateForm: (patch: Partial<Pick<FormSchema, "title" | "description" | "submittable">>) => void;
  updateTitleStyle: (
    patch: Partial<Pick<FormTitle, "fontSize" | "fontFamily" | "bold" | "italic" | "color">>,
  ) => void;
  setTheme: (theme: ThemeSettings) => void;
  setCanvasSize: (size: Partial<CanvasSettings>) => void;
  setGap: (gap: { x?: number; y?: number }) => void;
  setColumns: (columns: number) => void;
  setMaxWidth: (maxWidth: number | undefined) => void;
  fitCanvasToWidth: (targetWidth: number) => void;
  // ── multi-page actions (pdf mode) ──
  addPage: () => void;
  removePage: (index: number) => void;
  setActivePageIndex: (index: number) => void;

  // ── alignment guides (transient, cleared on drag end) ──
  alignGuides: AlignGuide[];
  updateAlignGuides: (guides: AlignGuide[]) => void;

  // ── layout actions ──
  updateLayout: (name: string, patch: Partial<LayoutBox>) => void;
  moveSelectedTo: (primary: string, pos: ScreenPoint) => void;
  resizeField: (name: string, box: LayoutBox) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  bringToFront: () => void;
  sendToBack: () => void;

  // ── selection actions ──
  select: (name: string | null) => void;
  toggleSelect: (name: string) => void;
  selectMany: (names: string[], additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectInRect: (rect: Rect, additive: boolean) => void;

  // ── interaction + history ──
  beginInteraction: () => void;
  endInteraction: () => void;
  finishDrag: () => void;
  undo: () => void;
  redo: () => void;

  // ── viewport actions ──
  setViewportSize: (width: number, height: number) => void;

  // ── grid actions ──
  toggleSnap: () => void;
  setGridSize: (n: number) => void;
  toggleColGuides: () => void;
  toggleRowGuides: () => void;

  // ── responsive actions ──
  setActiveBreakpoint: (bp: Breakpoint) => void;
  resetLayoutOverride: (name: string) => void;
};

export type SetFn = StoreApi<DesignerState>["setState"];
export type GetFn = StoreApi<DesignerState>["getState"];
