// Reusable signature pad. Capture a signature three ways — draw it on a canvas,
// upload an image file, or paste an image URL — emitting an image reference (a
// data URL for draw/upload, or the URL string) via `onChange`. Field-agnostic
// and self-contained, so it can be embedded anywhere: the signature field
// renderer, the preset-image picker in the designer, or any future host.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import Dropzone from "./Dropzone";

type Mode = "draw" | "upload" | "url";

const CANVAS_W = 600;
const CANVAS_H = 180;

export const DEFAULT_PREVIEW_MAX_W = 320;
export const DEFAULT_PREVIEW_MAX_H = 160;
export const DEFAULT_STROKE_COLOR = "#111827";
export const DEFAULT_STROKE_WIDTH = 2;

// Cap a preview image by width/height (px), keeping its aspect ratio. If the
// container is narrower than the width cap, the scrollable wrapper
// (`.ff-sign-preview-wrap`) keeps the image from overflowing the layout.
export function previewSizeStyle(
  maxWidth?: number,
  maxHeight?: number,
): CSSProperties {
  return {
    maxWidth: maxWidth ?? DEFAULT_PREVIEW_MAX_W,
    maxHeight: maxHeight ?? DEFAULT_PREVIEW_MAX_H,
  };
}

export type SignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  // Preview image caps (px).
  previewMaxWidth?: number;
  previewMaxHeight?: number;
};

function initialMode(value: string): Mode {
  return /^https?:\/\//i.test(value) ? "url" : "draw";
}

export default function SignaturePad({
  value,
  onChange,
  id,
  disabled,
  previewMaxWidth,
  previewMaxHeight,
}: SignaturePadProps) {
  const { t } = useTranslation("form");
  const current = value;
  const [mode, setMode] = useState<Mode>(() => initialMode(value));
  // Draw pen — adjustable live, in the toolbar right under the canvas.
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  // How the current value was produced. Re-entering draw mode only repaints the
  // canvas for a value that was actually drawn here; an uploaded or linked image
  // must never become a canvas "background" — it shows in the preview instead.
  const sourceRef = useRef<Mode | null>(
    /^https?:\/\//i.test(value) ? "url" : null,
  );

  const ctxOf = () => canvasRef.current?.getContext("2d") ?? null;

  // When (re)entering draw mode with an existing data-URL signature, paint it
  // back onto the canvas so the user sees what was captured before.
  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    const ctx = ctxOf();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Only restore a signature that was drawn on this canvas. An uploaded or
    // linked image is shown as a preview below — never painted in as background.
    if (sourceRef.current === "draw" && current.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = current;
    }
  }, [mode, current]);

  const pos = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = ctxOf();
    if (!ctx) return;
    drawing.current = true;
    canvasRef.current?.setPointerCapture(event.pointerId);
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    const { x, y } = pos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ctxOf();
    if (!ctx) return;
    const { x, y } = pos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      sourceRef.current = "draw";
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxOf();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    sourceRef.current = null;
    onChange("");
  };

  const readFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      sourceRef.current = "upload";
      onChange(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const modes: Mode[] = ["draw", "upload", "url"];

  // One preview of the current signature, shown across all modes so toggling
  // never hides it. The only case it skips is a freshly drawn signature while
  // the Draw tab is open — that's already on the canvas. An uploaded or linked
  // image always previews, even in draw mode.
  const paintedOnCanvas = mode === "draw" && sourceRef.current === "draw";
  const showPreview = !!current && !paintedOnCanvas;

  return (
    <div className="ff-sign">
      <div className="ff-sign-modes" role="tablist">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`ff-sign-mode${mode === m ? " is-active" : ""}`}
            onClick={() => setMode(m)}
            disabled={disabled}
          >
            {t(`designer.signature.${m}`)}
          </button>
        ))}
      </div>

      {mode === "draw" && (
        <div className="ff-sign-pad">
          <canvas
            id={id}
            ref={canvasRef}
            className="ff-sign-canvas"
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <div className="ff-sign-tools">
            <label className="ff-sign-tool">
              <span className="ff-sign-tool-label">
                {t("designer.signature.strokeColor")}
              </span>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="ff-sign-tool">
              <span className="ff-sign-tool-label">
                {t("designer.signature.strokeWidth")}
              </span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                disabled={disabled}
              />
            </label>
            <button
              type="button"
              className="ff-btn ff-btn-ghost ff-sign-clear"
              onClick={clear}
              disabled={disabled}
            >
              {t("designer.signature.clear")}
            </button>
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="ff-sign-upload">
          <Dropzone id={id} accept="image/*" disabled={disabled} onFile={readFile}>
            <span className="ff-dropzone-icon" aria-hidden="true">
              ⬆
            </span>
            <span className="ff-dropzone-text">
              {t("designer.signature.dropzone")}
            </span>
            <span className="ff-dropzone-hint">
              {t("designer.signature.dropzoneHint")}
            </span>
          </Dropzone>
        </div>
      )}

      {mode === "url" && (
        <div className="ff-sign-url">
          <input
            id={id}
            type="url"
            className="ff-input"
            placeholder={t("designer.signature.urlPlaceholder")}
            value={/^https?:\/\//i.test(current) ? current : ""}
            onChange={(e) => {
              sourceRef.current = "url";
              onChange(e.target.value);
            }}
            disabled={disabled}
          />
        </div>
      )}

      {showPreview && (
        <div className="ff-sign-preview-wrap">
          <img
            className="ff-sign-preview"
            src={current}
            alt=""
            style={previewSizeStyle(previewMaxWidth, previewMaxHeight)}
          />
        </div>
      )}
    </div>
  );
}
