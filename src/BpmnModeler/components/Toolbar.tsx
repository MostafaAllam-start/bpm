import type { ChangeEvent, RefObject } from "react";

type ToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
  onOpenFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadAllDetails: () => void;
  onExportXml: () => void;
  onExportSvg: () => void;
};

export default function Toolbar({
  fileInputRef,
  onNew,
  onOpenFile,
  onDownloadAllDetails,
  onExportXml,
  onExportSvg,
}: ToolbarProps) {
  return (
    <div className="bpmn-toolbar">
      <button type="button" onClick={onNew}>
        New
      </button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        Open…
      </button>
      <span className="bpmn-toolbar-spacer" />
      <button type="button" onClick={onDownloadAllDetails}>
        Download all details
      </button>
      <button type="button" onClick={onExportXml}>
        Download BPMN 2.0
      </button>
      <button type="button" onClick={onExportSvg}>
        Download SVG
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".bpmn,.xml,application/xml,text/xml"
        onChange={onOpenFile}
        hidden
      />
    </div>
  );
}
