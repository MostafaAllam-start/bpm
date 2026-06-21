// Floating toolbar over the canvas: undo/redo, snap-to-grid toggle, and the
// viewport controls (zoom out / zoom % / zoom in / fit to screen / reset). Reads
// and drives the designer store.

import { useTranslation } from "react-i18next";
import { useDesigner, useDesignerStoreApi } from "./designerStore";
import { BREAKPOINT_ORDER } from "../responsive";

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
  zoomIn: ico(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M11 8v6M8 11h6" /></>),
  zoomOut: ico(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M8 11h6" /></>),
  fit: ico(<><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></>),
  reset: ico(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /></>),
  grid: ico(<><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>),
  colGuides: ico(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16M15 4v16" /></>),
  rowGuides: ico(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18M3 14h18" /></>),
};

export default function CanvasToolbar() {
  const { t } = useTranslation("form");
  const store = useDesignerStoreApi();

  const zoom = useDesigner((s) => s.zoom);
  const snap = useDesigner((s) => s.snap);
  const showColGuides = useDesigner((s) => s.showColGuides);
  const showRowGuides = useDesigner((s) => s.showRowGuides);
  const canUndo = useDesigner((s) => s.past.length > 0);
  const canRedo = useDesigner((s) => s.future.length > 0);
  const activeBreakpoint = useDesigner((s) => s.activeBreakpoint);

  const st = store.getState();

  return (
    <div className="dz-toolbar">
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
            {t(`designer.breakpoints.${bp}`)}
          </button>
        ))}
      </div>

      <div className="dz-toolbar-group">
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.zoomOut()}
          title={t("designer.canvas.zoomOut")}
          aria-label={t("designer.canvas.zoomOut")}
        >
          {ICONS.zoomOut}
        </button>
        <button
          type="button"
          className="dz-tool dz-tool-zoom"
          onClick={() => st.setZoom(1)}
          title={t("designer.canvas.resetZoom")}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.zoomIn()}
          title={t("designer.canvas.zoomIn")}
          aria-label={t("designer.canvas.zoomIn")}
        >
          {ICONS.zoomIn}
        </button>
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.fitToScreen()}
          title={t("designer.canvas.fit")}
          aria-label={t("designer.canvas.fit")}
        >
          {ICONS.fit}
        </button>
        <button
          type="button"
          className="dz-tool"
          onClick={() => st.resetView()}
          title={t("designer.canvas.resetView")}
          aria-label={t("designer.canvas.resetView")}
        >
          {ICONS.reset}
        </button>
      </div>
    </div>
  );
}
