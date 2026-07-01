// The design tab's toolbar bar (full width, under the tab navigation): the field
// palette toggle at the start, then undo/redo, snap-to-grid + guide toggles, the
// breakpoint switcher, and the properties-panel toggle pushed to the end. Reads
// and drives the designer store; the two panel toggles are owned by the editor
// shell and passed in. The canvas renders the form at a fixed 1:1 scale and
// scrolls when it overflows, so there are no zoom/fit/reset controls.

import { useTranslation } from "react-i18next";
import type { Breakpoint } from "../types";
import { useDesigner, useDesignerStoreApi } from "./designerStore";
import { BREAKPOINT_ORDER } from "../utils/responsive";
import { useDesignerMode } from "./DesignerModeContext";

// Panel-toggle icon: a frame with a highlighted left-hand rail, echoing the field
// palette column it shows/hides.
function FieldsPanelIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <line x1="7.5" y1="3.5" x2="7.5" y2="16.5" />
    </svg>
  );
}

// Panel-toggle icon: a frame with a highlighted right-hand rail, echoing the
// properties column it shows/hides.
function PropsPanelIcon(): React.ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
      <line x1="12.5" y1="3.5" x2="12.5" y2="16.5" />
    </svg>
  );
}

// Small inline icons in the app's stroke style.
const ico = (path: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);
const ICONS = {
  undo: ico(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10H9" /></>),
  redo: ico(<><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h6" /></>),
  grid: ico(<><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>),
  colGuides: ico(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16M15 4v16" /></>),
  rowGuides: ico(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18M3 14h18" /></>),
};

const BREAKPOINT_ICONS: Record<Breakpoint, React.ReactNode> = {
  base:    ico(<><rect x="3" y="5" width="18" height="12" rx="2" /><rect x="7" y="9" width="7" height="9" rx="1.5" /><path d="M12 17v2M9 19h6" /></>),
  mobile:  ico(<><rect x="7" y="2" width="10" height="18" rx="2.5" /><circle cx="12" cy="17.5" r="0.75" fill="currentColor" /></>),
  tablet:  ico(<><rect x="3" y="4" width="18" height="14" rx="2.5" /><circle cx="19.5" cy="11" r="0.75" fill="currentColor" /></>),
  desktop: ico(<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>),
};

type CanvasToolbarProps = {
  // The field-palette and properties-panel visibility, owned by the editor shell.
  // Their toggle buttons sit at the start and end of this bar.
  showFields: boolean;
  onToggleFields: () => void;
  showProps: boolean;
  onToggleProps: () => void;
};

export default function CanvasToolbar({
  showFields,
  onToggleFields,
  showProps,
  onToggleProps,
}: CanvasToolbarProps) {
  const { t } = useTranslation("form");
  const store = useDesignerStoreApi();
  const mode = useDesignerMode();

  const snap = useDesigner((s) => s.snap);
  const showColGuides = useDesigner((s) => s.showColGuides);
  const showRowGuides = useDesigner((s) => s.showRowGuides);
  const canUndo = useDesigner((s) => s.past.length > 0);
  const canRedo = useDesigner((s) => s.future.length > 0);
  const activeBreakpoint = useDesigner((s) => s.activeBreakpoint);
  const pageCount = useDesigner((s) => s.schema.pages.length);
  const activePageIndex = useDesigner((s) => s.activePageIndex);
  const currentPageSize = useDesigner((s) => s.schema.canvas?.pageSize ?? "a4");

  const st = store.getState();

  return (
    <div className="dz-toolbar">
      <div className="dz-toolbar-group">
        <button
          type="button"
          className={`dz-tool${showFields ? " is-active" : ""}`}
          onClick={onToggleFields}
          aria-pressed={showFields}
          aria-label={showFields ? t("designer.hideFields") : t("designer.showFields")}
          title={showFields ? t("designer.hideFields") : t("designer.showFields")}
        >
          <FieldsPanelIcon />
        </button>
      </div>

      <div className="dz-toolbar-group">
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.undo()}
          disabled={!canUndo}
          title={t("designer.canvas.undo")}
          aria-label={t("designer.canvas.undo")}
        >
          {ICONS.undo}
        </button>
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.redo()}
          disabled={!canRedo}
          title={t("designer.canvas.redo")}
          aria-label={t("designer.canvas.redo")}
        >
          {ICONS.redo}
        </button>
      </div>

      <div className="dz-toolbar-group">
        <button
          type="button"
          className={`dz-tool${snap ? " is-active" : ""}`}
          onClick={() => st.toggleSnap()}
          title={t("designer.canvas.snap")}
          aria-pressed={snap}
        >
          {ICONS.grid}
        </button>
        <button
          type="button"
          className={`dz-tool${showColGuides ? " is-active" : ""}`}
          onClick={() => st.toggleColGuides()}
          title={t("designer.canvas.colGuides")}
          aria-label={t("designer.canvas.colGuides")}
          aria-pressed={showColGuides}
        >
          {ICONS.colGuides}
        </button>
        <button
          type="button"
          className={`dz-tool${showRowGuides ? " is-active" : ""}`}
          onClick={() => st.toggleRowGuides()}
          title={t("designer.canvas.rowGuides")}
          aria-label={t("designer.canvas.rowGuides")}
          aria-pressed={showRowGuides}
        >
          {ICONS.rowGuides}
        </button>
      </div>

      <div className="dz-toolbar-group dz-bp-group">
        {BREAKPOINT_ORDER.map((bp) => (
          <button
            key={bp}
            type="button"
            className={`dz-tool dz-bp${activeBreakpoint === bp ? " is-active" : ""}`}
            onClick={() => st.setActiveBreakpoint(bp)}
            title={t(`designer.breakpoints.hint.${bp}`)}
            aria-pressed={activeBreakpoint === bp}
          >
            {BREAKPOINT_ICONS[bp]}
            <span className="dz-bp-label">{t(`designer.breakpoints.${bp}`)}</span>
          </button>
        ))}
      </div>

      {mode === "pdf" && (
        <div className="dz-toolbar-group dz-toolbar-pdf">
          <select
            className="dz-tool dz-tool-select"
            value={currentPageSize}
            onChange={(e) => {
              const sizes: Record<string, { w: number; h: number }> = {
                a4: { w: 794, h: 1123 },
                letter: { w: 816, h: 1056 },
                a3: { w: 1123, h: 1588 },
              };
              const sz = sizes[e.target.value];
              st.setCanvasSize({
                ...(sz ? { width: sz.w } : {}),
                pageSize: e.target.value as "a4" | "letter" | "a3" | "custom",
                ...(sz ? { pageWidth: sz.w, pageHeight: sz.h } : {}),
              });
            }}
            title={t("designer.canvas.pageSize", "Page size")}
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
            <option value="a3">A3</option>
            <option value="custom">{t("designer.canvas.custom", "Custom")}</option>
          </select>
          <span className="dz-toolbar-sep" />
          <button
            type="button"
            className="dz-tool"
            onClick={() => st.addPage()}
            title={t("designer.canvas.addPage", "Add page")}
          >
            {ico(<><path d="M12 5v14M5 12h14" /></>)}
          </button>
          <button
            type="button"
            className="dz-tool"
            onClick={() => st.removePage(activePageIndex)}
            disabled={pageCount <= 1}
            title={t("designer.canvas.removePage", "Remove current page")}
          >
            {ico(<><path d="M5 12h14" /></>)}
          </button>
          <span className="dz-toolbar-text">
            {t("designer.canvas.pageOf", { current: activePageIndex + 1, total: pageCount })}
          </span>
        </div>
      )}

      <div className="dz-toolbar-group dz-toolbar-end">
        <button
          type="button"
          className={`dz-tool${showProps ? " is-active" : ""}`}
          onClick={onToggleProps}
          aria-pressed={showProps}
          aria-label={showProps ? t("designer.hideProps") : t("designer.showProps")}
          title={showProps ? t("designer.hideProps") : t("designer.showProps")}
        >
          <PropsPanelIcon />
        </button>
      </div>
    </div>
  );
}
