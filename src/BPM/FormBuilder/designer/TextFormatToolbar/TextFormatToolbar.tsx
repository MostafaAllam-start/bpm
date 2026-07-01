// Floating rich-text toolbar that appears above a focused contentEditable field.
// Shows as soon as the InlineEditor gains focus (not just when text is selected)
// and stays anchored to the top edge of the field. Bold/italic/underline state
// updates on every selectionchange. Hides when the editor loses focus.

import { useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  TextDirectionLtrIcon,
  TextDirectionRtlIcon,
  FontColorIcon,
  HighlightColorIcon,
} from "@components/icons/index.ts";
import { initialTextFormatState, textFormatReducer } from "./textFormatReducer";
import "./TextFormatToolbar.css";

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48];

function ColorSwatchButton({
  value,
  onChange,
  title,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      className="tf-btn tf-color-btn"
      title={title}
      onClick={() => ref.current?.click()}
    >
      {children}
      <input
        ref={ref}
        type="color"
        value={value}
        className="tf-color-input"
        onChange={(e) => onChange(e.target.value)}
      />
    </button>
  );
}

export default function TextFormatToolbar() {
  const [state, dispatch] = useReducer(textFormatReducer, initialTextFormatState);
  // Saved before the <select> (or any non-button) steals focus and collapses the selection.
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    // Returns the nearest contentEditable ancestor of `el` (or `el` itself).
    const getEditor = (el: EventTarget | null): HTMLElement | null => {
      const node = el as HTMLElement | null;
      if (!node) return null;
      return (node.closest?.("[contenteditable]") as HTMLElement | null) ?? null;
    };

    const getDir = (ce: HTMLElement): "ltr" | "rtl" | null => {
      const d = ce.dir;
      return d === "ltr" ? "ltr" : d === "rtl" ? "rtl" : null;
    };

    // Show the toolbar above the field actions bar (EN/AR toggle + trash).
    // Walks up from the contentEditable to find .dz-lc-lang-toggle; the CSS
    // transform on .tf-toolbar lifts it 6px above whatever top edge we give it.
    const showForEditor = (ce: HTMLElement) => {
      const widget = ce.closest?.(".dz-lc") as HTMLElement | null;
      const langToggle = widget?.querySelector(".dz-lc-lang-toggle") as HTMLElement | null;
      const anchor = langToggle ?? ce;
      const rect = anchor.getBoundingClientRect();

      const align = document.queryCommandState("justifyLeft")
        ? ("left" as const)
        : document.queryCommandState("justifyCenter")
          ? ("center" as const)
          : document.queryCommandState("justifyRight")
            ? ("right" as const)
            : null;

      dispatch({
        type: "SHOW",
        x: rect.left + rect.width / 2,
        y: rect.top,
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        align,
        dir: getDir(ce),
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      const ce = getEditor(e.target);
      if (ce) showForEditor(ce);
    };

    const onFocusOut = (e: FocusEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      // Keep showing if focus moved to the toolbar or another contentEditable.
      if (related?.closest?.(".tf-toolbar")) return;
      if (getEditor(related)) return;
      dispatch({ type: "HIDE" });
    };

    // Walk up from the cursor's anchor node to find the nearest element with an
    // explicit inline font-size (set by our applyFontSize). Stops at the
    // contentEditable boundary so we don't read inherited app-shell sizes.
    const getFontSizeAtCursor = (ce: HTMLElement): string | undefined => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return undefined;
      let el: HTMLElement | null =
        sel.anchorNode instanceof HTMLElement
          ? sel.anchorNode
          : (sel.anchorNode?.parentElement ?? null);
      while (el && el !== ce) {
        if (el.style?.fontSize) return el.style.fontSize.replace(/px$/, "");
        el = el.parentElement;
      }
      return undefined;
    };

    // Update formatting state as the selection changes.
    // Also snapshots the Range so it can be restored after the <select> steals focus.
    const onSelectionChange = () => {
      const ce = getEditor(document.activeElement);
      if (!ce) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
      dispatch({
        type: "REFRESH_STATES",
        fontSize: getFontSizeAtCursor(ce),
        dir: getDir(ce),
      });
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  if (!state.pos) return null;

  // Rendered into document.body so the toolbar escapes every stacking context
  // in the canvas tree (overflow, transform, z-index containment) and always
  // paints on top of all canvas fields regardless of their individual z-index.

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    dispatch({ type: "REFRESH_STATES" });
  };

  const applyFontSize = (px: string) => {
    const sel = window.getSelection();
    if (!sel) return;
    // Opening the <select> moves focus out of the contentEditable, which clears
    // (or staleizes) its DOM selection. Always re-focus the editor and restore
    // the snapshot taken before focus left, so the size applies to the text the
    // user originally selected — not to an empty/collapsed leftover range.
    const saved = savedRangeRef.current;
    if (saved) {
      const anchor =
        saved.commonAncestorContainer instanceof HTMLElement
          ? saved.commonAncestorContainer
          : saved.commonAncestorContainer.parentElement;
      const ce = anchor?.closest("[contenteditable]") as HTMLElement | null;
      ce?.focus();
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;

    if (range.collapsed) {
      // No text selected — insert a zero-width-space inside the span so the
      // browser anchors the cursor inside it; subsequent typed characters inherit
      // the font-size instead of reverting to the surrounding default.
      span.textContent = "​";
      range.insertNode(span);
      const r = document.createRange();
      r.setStart(span.firstChild!, 1); // after ZWS, cursor inside the span
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      // Text is selected — wrap it and place the caret *inside* the span's last
      // text node (not at the element boundary), so continued typing inherits the
      // font-size instead of landing in the surrounding text after the span.
      span.appendChild(range.extractContents());
      range.insertNode(span);
      const r = document.createRange();
      const last = span.lastChild;
      if (last && last.nodeType === Node.TEXT_NODE) {
        r.setStart(last, (last as Text).length);
        r.collapse(true);
      } else {
        r.selectNodeContents(span);
        r.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(r);
    }
    // Re-snapshot so a follow-up size change (without re-selecting) still has a
    // valid range to restore.
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    dispatch({ type: "SET_FONT_SIZE", value: px });
  };

  const applyColor = (color: string) => {
    document.execCommand("foreColor", false, color);
    dispatch({ type: "SET_FONT_COLOR", value: color });
  };

  const applyBgColor = (color: string) => {
    document.execCommand("hiliteColor", false, color);
    dispatch({ type: "SET_BG_COLOR", value: color });
  };

  const getEditableEl = (): HTMLElement | null =>
    (window
      .getSelection()
      ?.anchorNode?.parentElement?.closest("[contenteditable]") as HTMLElement | null) ?? null;

  return createPortal(
    <div
      className="tf-toolbar"
      style={{ left: state.pos.x, top: state.pos.y }}
      onMouseDown={(e) => {
        // Prevent focus from moving away from the contentEditable when clicking
        // toolbar buttons. Skip for <select> (needs its native mousedown to open
        // the dropdown) and <input type=color> (handled by stopPropagation on the
        // input itself so the color picker can open).
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT" || t.tagName === "OPTION") return;
        e.preventDefault();
      }}
    >
      <button
        type="button"
        className={`tf-btn${state.bold ? " is-active" : ""}`}
        title="Bold"
        onClick={() => exec("bold")}
      >
        <BoldIcon />
      </button>
      <button
        type="button"
        className={`tf-btn${state.italic ? " is-active" : ""}`}
        title="Italic"
        onClick={() => exec("italic")}
      >
        <ItalicIcon />
      </button>
      <button
        type="button"
        className={`tf-btn${state.underline ? " is-active" : ""}`}
        title="Underline"
        onClick={() => exec("underline")}
      >
        <UnderlineIcon />
      </button>

      <span className="tf-sep" />

      <button
        type="button"
        className={`tf-btn${state.dir === "ltr" ? " is-active" : ""}`}
        title="Left-to-right"
        onClick={() => {
          const el = getEditableEl();
          if (el) {
            el.dir = "ltr";
            dispatch({ type: "SET_DIR", value: "ltr" });
          }
        }}
      >
        <TextDirectionLtrIcon />
      </button>
      <button
        type="button"
        className={`tf-btn${state.dir === "rtl" ? " is-active" : ""}`}
        title="Right-to-left"
        onClick={() => {
          const el = getEditableEl();
          if (el) {
            el.dir = "rtl";
            dispatch({ type: "SET_DIR", value: "rtl" });
          }
        }}
      >
        <TextDirectionRtlIcon />
      </button>

      <span className="tf-sep" />

      <button
        type="button"
        className={`tf-btn${state.align === "left" ? " is-active" : ""}`}
        title="Align left"
        onClick={() => exec("justifyLeft")}
      >
        <AlignLeftIcon />
      </button>
      <button
        type="button"
        className={`tf-btn${state.align === "center" ? " is-active" : ""}`}
        title="Align center"
        onClick={() => exec("justifyCenter")}
      >
        <AlignCenterIcon />
      </button>
      <button
        type="button"
        className={`tf-btn${state.align === "right" ? " is-active" : ""}`}
        title="Align right"
        onClick={() => exec("justifyRight")}
      >
        <AlignRightIcon />
      </button>

      <span className="tf-sep" />

      <select
        className="tf-select"
        value={state.fontSize}
        title="Font size"
        // Stop propagation so the toolbar div's e.preventDefault() doesn't block
        // the native dropdown from opening.
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => applyFontSize(e.target.value)}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={String(s)}>
            {s}
          </option>
        ))}
      </select>

      <span className="tf-sep" />

      <ColorSwatchButton value={state.fontColor} onChange={applyColor} title="Text color">
        <FontColorIcon color={state.fontColor} />
      </ColorSwatchButton>
      <ColorSwatchButton value={state.bgColor} onChange={applyBgColor} title="Highlight color">
        <HighlightColorIcon color={state.bgColor} />
      </ColorSwatchButton>
    </div>,
    document.body,
  );
}
