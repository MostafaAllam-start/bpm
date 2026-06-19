import type { ChangeEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import ExampleMenu from "../../components/ExampleMenu.tsx";
import type { DiagramExample } from "../../examples.ts";
import type { SavedActorForm } from "../../types.ts";

// The workflow designer's toolbar: New / Open (BPMN or JSON) / Examples, the
// undo-redo pair, auto-layout, the token-simulation toggle, and the export
// cluster (details JSON, BPMN XML, SVG, workflow JSON).

type FlowToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  jsonInputRef: RefObject<HTMLInputElement | null>;
  onNew: () => void;
  onOpenFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenJson: (event: ChangeEvent<HTMLInputElement>) => void;
  onSaveJson: () => void;
  onDownloadAllDetails: () => void;
  onExportXml: () => void;
  onExportSvg: () => void;
  onAutoLayout: () => void;
  examples: DiagramExample[];
  onLoadExample: (xml: string, forms: Record<string, SavedActorForm>) => void;
  simulating: boolean;
  onToggleSimulation: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

const PlusIcon = () => <svg {...iconProps}><path d="M12 5v14M5 12h14" /></svg>;
const FolderIcon = () => <svg {...iconProps}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>;
const PackageIcon = () => <svg {...iconProps}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>;
const CodeIcon = () => <svg {...iconProps}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>;
const ImageIcon = () => <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>;
const PlayIcon = () => <svg {...iconProps}><path d="M6 4l14 8-14 8V4Z" /></svg>;
const StopIcon = () => <svg {...iconProps}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>;
const UndoIcon = () => <svg {...iconProps}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>;
const RedoIcon = () => <svg {...iconProps}><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg>;
const LayoutIcon = () => <svg {...iconProps}><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" /><path d="M10 7h4a2 2 0 0 1 2 2v5" /></svg>;
const SaveIcon = () => <svg {...iconProps}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>;
const JsonIcon = () => <svg {...iconProps}><path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2" /></svg>;

export default function FlowToolbar({
  fileInputRef,
  jsonInputRef,
  onNew,
  onOpenFile,
  onOpenJson,
  onSaveJson,
  onDownloadAllDetails,
  onExportXml,
  onExportSvg,
  onAutoLayout,
  examples,
  onLoadExample,
  simulating,
  onToggleSimulation,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: FlowToolbarProps) {
  const { t } = useTranslation("bpmn");
  return (
    <div className="bpmn-toolbar">
      <div className="bpmn-toolbar-group">
        <button type="button" className="tb-btn tb-btn-primary" onClick={onNew}>
          <PlusIcon />
          {t("toolbar.new")}
        </button>
        <button type="button" className="tb-btn" onClick={() => fileInputRef.current?.click()}>
          <FolderIcon />
          {t("toolbar.open")}
        </button>
        <button type="button" className="tb-btn" onClick={() => jsonInputRef.current?.click()}>
          <JsonIcon />
          {t("toolbar.openJson")}
        </button>
        <ExampleMenu examples={examples} onSelect={onLoadExample} />
      </div>

      <div className="bpmn-toolbar-group">
        <button type="button" className="tb-btn tb-btn-icon" onClick={onUndo} disabled={!canUndo} title={t("toolbar.undo")}>
          <UndoIcon />
        </button>
        <button type="button" className="tb-btn tb-btn-icon" onClick={onRedo} disabled={!canRedo} title={t("toolbar.redo")}>
          <RedoIcon />
        </button>
        <button type="button" className="tb-btn" onClick={onAutoLayout}>
          <LayoutIcon />
          {t("toolbar.autoLayout")}
        </button>
        <button
          type="button"
          className={`tb-btn${simulating ? " tb-btn-primary" : ""}`}
          onClick={onToggleSimulation}
        >
          {simulating ? <StopIcon /> : <PlayIcon />}
          {simulating ? t("toolbar.stopSimulation") : t("toolbar.simulate")}
        </button>
      </div>

      <span className="bpmn-toolbar-spacer" />

      <div className="bpmn-toolbar-group">
        <button type="button" className="tb-btn tb-btn-ghost" onClick={onSaveJson}>
          <SaveIcon />
          {t("toolbar.saveJson")}
        </button>
        <button type="button" className="tb-btn tb-btn-ghost" onClick={onDownloadAllDetails}>
          <PackageIcon />
          {t("toolbar.downloadAll")}
        </button>
        <button type="button" className="tb-btn tb-btn-ghost" onClick={onExportXml}>
          <CodeIcon />
          {t("toolbar.downloadBpmn")}
        </button>
        <button type="button" className="tb-btn tb-btn-ghost" onClick={onExportSvg}>
          <ImageIcon />
          {t("toolbar.downloadSvg")}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".bpmn,.xml,application/xml,text/xml" onChange={onOpenFile} hidden />
      <input ref={jsonInputRef} type="file" accept=".json,application/json" onChange={onOpenJson} hidden />
    </div>
  );
}
