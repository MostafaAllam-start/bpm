// Reusable file dropzone: drag & drop a file or click to browse. Renders the
// `.ff-dropzone` shell with caller-provided prompt content (icon / text / hint)
// and hands the chosen File to `onFile`. Shared by the image- and file-upload
// fields and the signature pad's upload mode.

import { useRef, useState, type ReactNode } from "react";

export type DropzoneProps = {
  id?: string;
  accept?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  children: ReactNode;
};

export default function Dropzone({
  id,
  accept,
  disabled,
  onFile,
  children,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const take = (file: File | undefined | null) => {
    if (!disabled && file) onFile(file);
  };

  return (
    <div
      className={`ff-dropzone${dragOver ? " is-over" : ""}${
        disabled ? " is-disabled" : ""
      }`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="ff-dropzone-input"
        onChange={(e) => take(e.target.files?.[0])}
        // The wrapper's onClick calls input.click(); without this the synthetic
        // click bubbles back and reopens the file dialog twice.
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
      />
      {children}
    </div>
  );
}
