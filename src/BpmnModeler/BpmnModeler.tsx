// bpmn-js ships its own stylesheets. The diagram-js + bpmn-js CSS provide the
// canvas / palette / context-pad styling, and the bpmn-font CSS renders the
// shape icons (tasks, gateways, events, ...).
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
// Properties panel (edit a selected element's name/id/...) and token simulation
// (animate tokens through the flow) — both are bpmn.io add-ons.
import "@bpmn-io/properties-panel/dist/assets/properties-panel.css";
import "bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css";
// Color picker: adds a "Set color" context-pad entry with a swatch popup.
import "bpmn-js-color-picker/colors/color-picker.css";

import "./BpmnModeler.css";

import ActorContextMenu from "./components/ActorContextMenu.tsx";
import ActorSelectorModal from "./components/ActorSelectorModal.tsx";
import DiagramCanvas from "./components/DiagramCanvas.tsx";
import ErrorBanner from "./components/ErrorBanner.tsx";
import Toolbar from "./components/Toolbar.tsx";
import { useActorSelector } from "./hooks/useActorSelector.ts";
import { useBpmnModeler } from "./hooks/useBpmnModeler.ts";
import { useDiagramActions } from "./hooks/useDiagramActions.ts";
import { DIAGRAM_EXAMPLES } from "./examples.ts";
import type { BpmnEditorProps } from "./types.ts";

// Thin shell that wires the logic hooks (modeler lifecycle, diagram actions,
// actor selection) into the presentational subcomponents. All behaviour lives
// in the hooks; everything rendered here is in `./components`.
export default function BpmnEditor({
  savedActorForms,
  onOpenActorForm,
}: BpmnEditorProps) {
  const {
    containerRef,
    propertiesRef,
    modelerRef,
    error,
    setError,
    contextMenu,
    setContextMenu,
    selectableModules,
    selectedModuleIds,
    toggleModule,
  } = useBpmnModeler();

  const {
    fileInputRef,
    handleNew,
    handleOpenFile,
    handleLoadExample,
    handleDownloadAllDetails,
    handleExportXml,
    handleExportSvg,
  } = useDiagramActions({ modelerRef, savedActorForms, setError });

  const {
    actorSelector,
    openActorSelector,
    closeActorSelector,
    createActorForm,
    confirmActorSelection,
    canSave,
    controls,
  } = useActorSelector({ modelerRef, onOpenActorForm, setContextMenu });

  return (
    <div className="bpmn-editor">
      <Toolbar
        fileInputRef={fileInputRef}
        onNew={handleNew}
        onOpenFile={handleOpenFile}
        onDownloadAllDetails={handleDownloadAllDetails}
        onExportXml={handleExportXml}
        onExportSvg={handleExportSvg}
        modules={selectableModules}
        selectedModuleIds={selectedModuleIds}
        onToggleModule={toggleModule}
        examples={DIAGRAM_EXAMPLES}
        onLoadExample={handleLoadExample}
      />

      <DiagramCanvas containerRef={containerRef} propertiesRef={propertiesRef} />

      {contextMenu && (
        <ActorContextMenu
          contextMenu={contextMenu}
          hasSavedForm={Boolean(savedActorForms?.[contextMenu.actorId])}
          onCreateForm={createActorForm}
          onSelectActor={openActorSelector}
        />
      )}

      {actorSelector && (
        <ActorSelectorModal
          actorSelector={actorSelector}
          controls={controls}
          canSave={canSave}
          onClose={closeActorSelector}
          onConfirm={confirmActorSelection}
        />
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  );
}
