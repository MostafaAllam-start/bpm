// Image-, signature- and file-upload input fields. Each captures a file through
// a drag & drop (or click) dropzone. The image/signature fields store a data URL
// and preview a thumbnail; the file field stores the file's metadata + data URL
// and shows a chip with its name and size.

import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../utils/fieldTypes";
import type { FormFileValue } from "../types";
import Dropzone from "./Dropzone";

function readAsDataUrl(file: File, onDone: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

// Shared image-dropzone body: upload an image (stored as a data URL) with a
// thumbnail preview. Prompt text and icon vary by host field (image vs
// signature), so they're passed in.
function ImageDropzone({
  p,
  glyph,
  promptKey,
  hintKey,
}: {
  p: FieldRenderProps;
  glyph: string;
  promptKey: string;
  hintKey: string;
}) {
  const { t } = useTranslation("form");
  const current = typeof p.value === "string" ? p.value : "";
  return (
    <div className="ff-upload">
      <Dropzone
        id={p.id}
        accept="image/*"
        disabled={p.disabled}
        onFile={(f) => {
          if (f.type.startsWith("image/")) readAsDataUrl(f, p.onChange);
        }}
      >
        <span className="ff-dropzone-icon" aria-hidden="true">
          {glyph}
        </span>
        <span className="ff-dropzone-text">{t(promptKey)}</span>
        <span className="ff-dropzone-hint">{t(hintKey)}</span>
      </Dropzone>
      {current && (
        <div className="ff-upload-preview">
          <div className="ff-sign-preview-wrap">
            <img className="ff-sign-preview" src={current} alt="" />
          </div>
          <button
            type="button"
            className="ff-btn ff-btn-ghost ff-upload-remove"
            onClick={() => p.onChange("")}
            disabled={p.disabled}
          >
            {t("designer.upload.remove")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ImageUploadField(p: FieldRenderProps) {
  return (
    <ImageDropzone
      p={p}
      glyph="🖼"
      promptKey="designer.upload.imagePrompt"
      hintKey="designer.upload.imageHint"
    />
  );
}

export function SignatureUploadField(p: FieldRenderProps) {
  return (
    <ImageDropzone
      p={p}
      glyph="✍"
      promptKey="designer.upload.signaturePrompt"
      hintKey="designer.upload.signatureHint"
    />
  );
}

function isFileValue(v: unknown): v is FormFileValue {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>).dataUrl === "string"
  );
}

function formatSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const file = isFileValue(p.value) ? p.value : null;
  return (
    <div className="ff-upload">
      <Dropzone
        id={p.id}
        accept={p.field.accept}
        disabled={p.disabled}
        onFile={(f) =>
          readAsDataUrl(f, (dataUrl) =>
            p.onChange({ name: f.name, type: f.type, size: f.size, dataUrl }),
          )
        }
      >
        <span className="ff-dropzone-icon" aria-hidden="true">
          📎
        </span>
        <span className="ff-dropzone-text">
          {t("designer.upload.filePrompt")}
        </span>
        <span className="ff-dropzone-hint">
          {p.field.accept || t("designer.upload.fileHint")}
        </span>
      </Dropzone>
      {file && (
        <div className="ff-file-chip">
          <span className="ff-file-icon" aria-hidden="true">
            📄
          </span>
          <span className="ff-file-name" title={file.name}>
            {file.name}
          </span>
          {formatSize(file.size) && (
            <span className="ff-file-size">{formatSize(file.size)}</span>
          )}
          <button
            type="button"
            className="ff-file-remove"
            aria-label={t("designer.upload.remove")}
            title={t("designer.upload.remove")}
            onClick={() => p.onChange(null)}
            disabled={p.disabled}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
