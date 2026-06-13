import type { ChangeEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import ModuleMenu from "./ModuleMenu.tsx";
import ExampleMenu from "./ExampleMenu.tsx";
import type { SelectableModule } from "../modules.ts";
import type { DiagramExample } from "../examples.ts";

type ToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
  onOpenFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadAllDetails: () => void;
  onExportXml: () => void;
  onExportSvg: () => void;
  modules: SelectableModule[];
  selectedModuleIds: string[];
  onToggleModule: (id: string) => void;
  examples: DiagramExample[];
  onLoadExample: (xml: string) => void;
};

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg {...iconProps}>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

export default function Toolbar({
  fileInputRef,
  onNew,
  onOpenFile,
  onDownloadAllDetails,
  onExportXml,
  onExportSvg,
  modules,
  selectedModuleIds,
  onToggleModule,
  examples,
  onLoadExample,
}: ToolbarProps) {
  const { t } = useTranslation("bpmn");
  return (
    <div className="bpmn-toolbar">
      <div className="bpmn-toolbar-group">
        <button type="button" className="tb-btn tb-btn-primary" onClick={onNew}>
          <PlusIcon />
          {t("toolbar.new")}
        </button>
        <button
          type="button"
          className="tb-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderIcon />
          {t("toolbar.open")}
        </button>
        <ExampleMenu examples={examples} onSelect={onLoadExample} />
        <ModuleMenu
          modules={modules}
          selectedIds={selectedModuleIds}
          onToggle={onToggleModule}
        />
      </div>

      <span className="bpmn-toolbar-spacer" />

      <div className="bpmn-toolbar-group">
        <button
          type="button"
          className="tb-btn tb-btn-ghost"
          onClick={onDownloadAllDetails}
        >
          <PackageIcon />
          {t("toolbar.downloadAll")}
        </button>
        <button
          type="button"
          className="tb-btn tb-btn-ghost"
          onClick={onExportXml}
        >
          <CodeIcon />
          {t("toolbar.downloadBpmn")}
        </button>
        <button
          type="button"
          className="tb-btn tb-btn-ghost"
          onClick={onExportSvg}
        >
          <ImageIcon />
          {t("toolbar.downloadSvg")}
        </button>
      </div>

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
