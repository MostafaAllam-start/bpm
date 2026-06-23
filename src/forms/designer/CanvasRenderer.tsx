// The free-form design canvas. A fixed "viewport" element hosts a transformed
// "stage" (translate by pan, scale by zoom); inside the stage sits the canvas
// "page" (the form's design surface) and one LayoutContainer per field, all in
// canvas-pixel space. The viewport owns the interactions the individual widgets
// don't: marquee selection, space/middle-button panning, wheel zoom/pan, palette
// drops, and the keyboard shortcuts (undo/redo, delete, duplicate, nudge…).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";

import type { FieldType, LayoutBox } from "../types";
import { getFieldType } from "../utils/fieldTypes";
import { resolveText } from "../utils/text";
import {
  FIT_MARGIN,
  PAGE_MARGIN,
  SUBMIT_NAME,
  TITLE_NAME,
  useDesigner,
  useDesignerStoreApi,
} from "./designerStore";
import { LayoutContainer } from "./LayoutContainer";
import { SubmitContainer } from "./SubmitContainer";
import { TitleContainer } from "./TitleContainer";
import { ADD_FIELD_MIME } from "./Palette";
import {
  boxesBottom,
  clampColumns,
  fieldsInBox,
  groupHeaderHeight,
  GROUP_PAD,
  PAGE_PADDING,
  rectFromPoints,
  rowBands,
} from "./canvasLayout";
import { breakpointWidth, resolveLayout, type Positioned } from "../utils/responsive";

type CanvasRendererProps = { locale: string };

// Did a pointer press land on the bare canvas (viewport / stage / page / empty
// hint) rather than on a field widget? Widget presses must be left to the
// widget's own selection handler and interact.js. The widget body and the empty
// hint are `pointer-events: none`, so a press over them resolves to the page;
// the widget root (.dz-lc) is the target for presses on a widget.
function isCanvasBackground(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.classList) return false;
  return (
    node.classList.contains("dz-canvas2") ||
    node.classList.contains("dz-stage") ||
    node.classList.contains("dz-page") ||
    node.classList.contains("dz-page-empty")
  );
}

// Is the user currently typing in a form control (so global keyboard shortcuts
// must stand down)?
function isEditingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable
  );
}

export default function CanvasRenderer({ locale }: CanvasRendererProps) {
  const { t } = useTranslation("form");
  const store = useDesignerStoreApi();

  const elements = useDesigner((s) => s.schema.pages[0]?.elements ?? []);
  const submit = useDesigner((s) => s.schema.submit);
  const titleBox = useDesigner((s) => s.schema.titleBox);
  const titleText = useDesigner((s) => s.schema.title);
  const selection = useDesigner((s) => s.selection);
  const zoom = useDesigner((s) => s.zoom);
  const pan = useDesigner((s) => s.pan);
  const snap = useDesigner((s) => s.snap);
  const canvas = useDesigner((s) => s.schema.canvas);
  const viewport = useDesigner((s) => s.viewport);
  // The field currently being dragged (a single-field move), or null. Drives the
  // row guide lines.
  const dragName = useDesigner((s) => s._dragName);
  // Whether the column grid / row band guideline overlays are shown (toolbar
  // toggles). Row guides also appear transiently while dragging regardless.
  const showColGuides = useDesigner((s) => s.showColGuides);
  const showRowGuides = useDesigner((s) => s.showRowGuides);
  // The breakpoint the canvas is designing; fields render at their resolved
  // layout for it and the page takes that breakpoint's width.
  const activeBreakpoint = useDesigner((s) => s.activeBreakpoint);

  const viewportRef = useRef<HTMLDivElement>(null);

  // Marquee rectangle (canvas space) while drag-selecting; null when inactive.
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  // Space held → pan mode (changes cursor + makes background drag pan).
  const [spaceHeld, setSpaceHeld] = useState(false);

  const selectionSet = new Set(selection);
  const primaryName = selection.length ? selection[selection.length - 1] : null;

  // Convert a client point to canvas space using the live pan/zoom.
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const p = store.getState().pan;
      const z = store.getState().zoom;
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return { x: (clientX - left - p.x) / z, y: (clientY - top - p.y) / z };
    },
    [store],
  );

  // ── viewport size → store; fit the page to the container ──────────────────
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let lastW = -1;

    // Fit so an auto-width form fills the container at 100% (a small margin each
    // side), then centre it. Deliberately uses only long-standing store methods
    // (fitCanvasToWidth / setPan), not a freshly added one, so it keeps working
    // even when a hot-reload preserved an older store instance.
    const fit = (force: boolean) => {
      const w = el.clientWidth;
      const st = store.getState();
      st.setViewportSize(w, el.clientHeight);
      if (w <= 0) return;
      // The form's design width auto-fits the container on every breakpoint (not
      // just "All"), so toggling the field / properties panels reflows the form to
      // the new width instead of leaving it at a fixed size.
      // On resize, only re-fit when the width actually changed and the user is at
      // 100% zoom, so a deliberate zoom isn't overridden. `force` (mount passes)
      // ignores that so the initial render always fits.
      if (!force && (Math.abs(w - lastW) <= 1 || st.zoom !== 1)) return;
      lastW = w;
      const auto = st.schema.canvas?.autoWidth !== false;
      const untouched =
        st.zoom === 1 && st.pan.x === PAGE_MARGIN && st.pan.y === PAGE_MARGIN;
      if (!(auto || untouched)) return;
      if (auto) {
        const inner = Math.max(360, Math.min(1280, w - FIT_MARGIN * 2));
        st.fitCanvasToWidth(inner);
      }
      const cur = store.getState();
      const cw = cur.schema.canvas?.width ?? 960;
      cur.setPan({
        x: Math.max(FIT_MARGIN, (w - cw * cur.zoom) / 2),
        y: PAGE_MARGIN,
      });
    };

    // Fit pre-paint, then again on the next frame to catch layout that only
    // settles after mount (the properties panel, web fonts, the modal's open
    // transition) — this is what makes the *initial* render fill the container.
    fit(true);
    const raf = requestAnimationFrame(() => fit(true));
    const ro = new ResizeObserver(() => fit(false));
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [store, activeBreakpoint]);

  // ── wheel: ctrl/⌘ + wheel zooms around the cursor; otherwise pans ─────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = store.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        st.zoomAround(factor, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        st.panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [store]);

  // ── global keyboard shortcuts (scoped to while the canvas is mounted) ─────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditingTarget(e.target)) {
        setSpaceHeld(true);
        if (!isEditingTarget(document.activeElement)) e.preventDefault();
      }
      if (isEditingTarget(e.target) || isEditingTarget(document.activeElement)) {
        return;
      }
      const st = store.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        st.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        st.duplicateSelected();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selection.length) {
          e.preventDefault();
          st.deleteSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        st.clearSelection();
        return;
      }
      if (e.key.startsWith("Arrow") && st.selection.length) {
        e.preventDefault();
        const base = st.snap ? st.gridSize : 1;
        const step = e.shiftKey ? base * 5 : base;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        st.nudgeSelected(dx, dy);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store]);

  // ── background pointer: pan (space/middle) or marquee-select ──────────────
  const panState = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; additive: boolean } | null>(
    null,
  );

  const onBackgroundPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // This handler sits on the viewport, an ancestor of every widget, so a press
    // on a widget bubbles here too. We must NOT marquee/clear/pan in that case —
    // the widget's own handler + interact.js own the gesture. Widgets no longer
    // stopPropagation (that would starve interact's document listener), so we
    // gate on the event target: act only when the press lands on bare canvas.
    if (!isCanvasBackground(e.target)) return;
    const panning = spaceHeld || e.button === 1;
    if (panning) {
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      viewportRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const start = toCanvas(e.clientX, e.clientY);
    marqueeStart.current = {
      x: start.x,
      y: start.y,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    };
    if (!marqueeStart.current.additive) store.getState().clearSelection();
    setMarquee({ x: start.x, y: start.y, width: 0, height: 0 });
    viewportRef.current?.setPointerCapture(e.pointerId);
  };

  const onBackgroundPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panState.current) {
      const { startX, startY, panX, panY } = panState.current;
      store.getState().setPan({
        x: panX + (e.clientX - startX),
        y: panY + (e.clientY - startY),
      });
      return;
    }
    if (marqueeStart.current) {
      const s = marqueeStart.current;
      const cur = toCanvas(e.clientX, e.clientY);
      setMarquee(rectFromPoints(s.x, s.y, cur.x, cur.y));
    }
  };

  const endBackgroundPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panState.current) {
      panState.current = null;
      viewportRef.current?.releasePointerCapture(e.pointerId);
      return;
    }
    if (marqueeStart.current) {
      const s = marqueeStart.current;
      const cur = toCanvas(e.clientX, e.clientY);
      const rect = rectFromPoints(s.x, s.y, cur.x, cur.y);
      // A negligible drag is a click on empty space → just clears (already did).
      if (rect.width > 3 || rect.height > 3) {
        store.getState().selectInRect(rect, s.additive);
      }
      marqueeStart.current = null;
      setMarquee(null);
      viewportRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  // ── palette drop → add a field at the drop point ──────────────────────────
  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(ADD_FIELD_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const onDrop = (e: DragEvent) => {
    const type = e.dataTransfer.getData(ADD_FIELD_MIME);
    if (!type) return;
    e.preventDefault();
    const def = getFieldType(type as FieldType);
    // The drop point decides where the new row is inserted; the store reflows the
    // fields below it down so nothing overlaps.
    const at = toCanvas(e.clientX, e.clientY);
    store
      .getState()
      .addField(
        type as FieldType,
        def ? t(`designer.types.${def.labelKey}`) : type,
        at,
      );
  };

  // Resolve each item's layout for the active breakpoint (base, or an override
  // that cascades to it). The canvas renders and measures these.
  const layoutFor = useCallback(
    (item: Positioned | undefined) => resolveLayout(item, activeBreakpoint),
    [activeBreakpoint],
  );
  const baseWidth = canvas?.width ?? 960;
  // The form keeps a single design width across every breakpoint: switching the
  // active breakpoint changes only which per-breakpoint layout overrides are
  // edited, never the canvas/page width. The column grid + guides follow it.
  const targetWidth = baseWidth;
  const submitLayout = layoutFor(submit);
  const titleLayout = layoutFor(titleBox);
  const resolvedBoxes = [
    ...elements.map((f) => layoutFor(f)),
    submitLayout,
    titleLayout,
  ].filter(Boolean) as LayoutBox[];
  // The page fills the container's height (so the design surface doesn't float in
  // empty canvas) but still grows past it to contain all content (fields + submit
  // button + title) when the form is taller than the viewport. The viewport-fill
  // term is computed from the live viewport size, which is set in the layout
  // effect before paint, so the surface is filled on the very first render.
  const contentBottom = boxesBottom(resolvedBoxes) + PAGE_PADDING;
  // The page is at least the breakpoint's target width, but grows to contain any
  // content that spills past it — e.g. a wider base ("All") layout inherited at a
  // narrower breakpoint — so the inherited design is always fully on the page
  // (not rendered off its right edge) and stays editable.
  const contentRight =
    resolvedBoxes.reduce((m, b) => Math.max(m, b.x + b.width), 0) + PAGE_PADDING;
  const pageWidth = Math.max(targetWidth, contentRight);
  const fillHeight =
    viewport.height > 0 ? (viewport.height - PAGE_MARGIN - FIT_MARGIN) / zoom : 0;
  const pageHeight = Math.max(240, Math.round(contentBottom), Math.round(fillHeight));

  // Row band guide lines: a line at the top of every row. Shown persistently
  // when the row-guides toggle is on, and always while a field is being dragged
  // (excluding the dragged field) so it's clear where it will line up.
  const rowGuides =
    showRowGuides || dragName != null
      ? rowBands(
          [
            ...elements
              .filter((f) => f.name !== dragName)
              .map((f) => layoutFor(f)),
            submitLayout,
          ].filter(Boolean) as LayoutBox[],
        ).map((b) => b.top)
      : [];

  // Column guidelines: the form's grid drawn across the page's content area for
  // the active breakpoint, plus — for any section that's selected or holds the
  // selection — that section's own column grid across its inner box. This is the
  // visual reference for sizing field widths in columns. Gated on the toggle.
  const columns = clampColumns(canvas?.columns);
  const resolvedEls = elements.map((f) => ({ ...f, layout: layoutFor(f) }));
  const groupGuides = showColGuides
    ? resolvedEls
        .filter((g) => g.type === "group" && g.layout)
        .filter(
          (g) =>
            selectionSet.has(g.name) ||
            fieldsInBox(resolvedEls, g.layout!, g.name).some((n) =>
              selectionSet.has(n),
            ),
        )
        .map((g) => {
          const headerH = groupHeaderHeight(g);
          return {
            name: g.name,
            left: g.layout!.x + GROUP_PAD,
            top: g.layout!.y + headerH,
            width: g.layout!.width - GROUP_PAD * 2,
            height: g.layout!.height - headerH - GROUP_PAD,
          };
        })
    : [];

  return (
    <div
      ref={viewportRef}
      className={`dz-canvas2${spaceHeld ? " is-panning" : ""}`}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onBackgroundPointerMove}
      onPointerUp={endBackgroundPointer}
      onPointerCancel={endBackgroundPointer}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="dz-stage"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        }}
      >
        {/* Dimension line above the form (only on a specific breakpoint, not the
            "All" base): a ruler spanning the form's width, labelled with that
            breakpoint's screen width — e.g. Mobile → 390px, SM → 640px. */}
        {activeBreakpoint !== "base" && (
          <div className="dz-dim" style={{ width: targetWidth }}>
            <span className="dz-dim-label">
              {breakpointWidth(activeBreakpoint, baseWidth)}px and up
            </span>
          </div>
        )}
        <div
          className={`dz-page${snap ? " has-grid" : ""}`}
          style={{
            width: pageWidth,
            height: pageHeight,
            backgroundSize: `${store.getState().gridSize}px ${store.getState().gridSize}px`,
          }}
        >
          {elements.length === 0 && (
            <p className="dz-page-empty">{t("designer.emptyHint")}</p>
          )}
          {showColGuides && (
            <ColumnGuides
              left={PAGE_PADDING}
              top={0}
              width={targetWidth - PAGE_PADDING * 2}
              height={pageHeight}
              columns={columns}
              numbered
            />
          )}
          {groupGuides.map((g) => (
            <ColumnGuides
              key={`col-guide-${g.name}`}
              left={g.left}
              top={g.top}
              width={g.width}
              height={g.height}
              columns={columns}
              accent
            />
          ))}
          {rowGuides.map((y, i) => (
            <div
              key={`row-guide-${i}`}
              className="dz-row-guide"
              style={{ top: y, width: pageWidth }}
            />
          ))}
          {elements.map((field) => {
            const fieldLayout = layoutFor(field);
            return fieldLayout ? (
              <LayoutContainer
                key={field.id ?? field.name}
                field={field}
                layout={fieldLayout}
                locale={locale}
                selected={selectionSet.has(field.name)}
                primary={field.name === primaryName}
              />
            ) : null;
          })}
          {titleLayout && (
            <TitleContainer
              layout={titleLayout}
              title={resolveText(titleText, locale)}
              style={titleBox}
              locale={locale}
              selected={selectionSet.has(TITLE_NAME)}
              primary={primaryName === TITLE_NAME}
            />
          )}
          {submitLayout && (
            <SubmitContainer
              layout={submitLayout}
              label={resolveText(submit?.label, locale) || undefined}
              locale={locale}
              selected={selectionSet.has(SUBMIT_NAME)}
              primary={primaryName === SUBMIT_NAME}
            />
          )}
          {marquee && (
            <div
              className="dz-marquee"
              style={{
                transform: `translate3d(${marquee.x}px, ${marquee.y}px, 0)`,
                width: marquee.width,
                height: marquee.height,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// A column grid overlay: `columns` equally spaced guide lines across [left,
// left+width], optionally with a 1..columns ruler along the top. Drawn behind the
// field widgets (pointer-events: none) as the visual reference for column-based
// widths. `accent` marks a section's own grid so it reads distinctly from the
// form grid drawn underneath it.
function ColumnGuides({
  left,
  top,
  width,
  height,
  columns,
  numbered,
  accent,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  columns: number;
  numbered?: boolean;
  accent?: boolean;
}) {
  if (width <= 0 || height <= 0 || columns < 1) return null;
  const colW = width / columns;
  return (
    <div
      className={`dz-col-guides${accent ? " is-accent" : ""}`}
      style={{ left, top, width, height }}
      aria-hidden="true"
    >
      {Array.from({ length: columns + 1 }, (_, i) => (
        <span key={i} className="dz-col-line" style={{ left: i * colW }} />
      ))}
      {numbered &&
        Array.from({ length: columns }, (_, i) => (
          <span
            key={`n${i}`}
            className="dz-col-num"
            style={{ left: i * colW, width: colW }}
          >
            {i + 1}
          </span>
        ))}
    </div>
  );
}
