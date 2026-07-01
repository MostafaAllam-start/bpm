import { useState } from "react";
import BpmnEditor, { type ActorFormMeta, type AvailableVariable } from "@bpmn";
import type { DesignerVariable } from "@FormBuilder";
import Modal from "@shared/Modal";
import FormBuilder from "@FormBuilder/FormBuilder.tsx";
import EmailDesigner from "@FormBuilder/EmailDesigner/index.ts";
import PdfDesigner from "@FormBuilder/PdfDesigner/index.ts";

type SavedDesign = {
  actorLabel: string;
  schema: object;
};

export default function BPM() {
  // Actor form (UserTask / ServiceTask etc.)
  const [savedActorForms, setSavedActorForms] = useState<Record<string, SavedDesign>>({});
  const [activeActorForm, setActiveActorForm] = useState<{
    actorId: string;
    actorLabel: string;
    schema?: object | null;
    currentActor?: ActorFormMeta;
    availableVariables?: DesignerVariable[];
  } | null>(null);
  const [formFull, setFormFull] = useState(false);
  const closeActorForm = () => { setActiveActorForm(null); setFormFull(false); };

  const handleOpenActorForm = (
    actorId: string,
    actorLabel: string,
    currentActor?: ActorFormMeta,
    availableVariables?: AvailableVariable[],
  ) => {
    const saved = savedActorForms[actorId];
    setActiveActorForm({
      actorId,
      actorLabel: saved?.actorLabel ?? actorLabel,
      schema: saved?.schema,
      currentActor,
      availableVariables: availableVariables ?? [],
    });
  };

  const handleSaveActorForm = (actorId: string, actorLabel: string, schema: object) => {
    setSavedActorForms((prev) => ({ ...prev, [actorId]: { actorLabel, schema } }));
    setActiveActorForm((prev) =>
      prev?.actorId === actorId
        ? { ...prev, actorLabel, schema }
        : { actorId, actorLabel, schema },
    );
  };

  // Email designer (SendEmailTask)
  const [savedEmailDesigns, setSavedEmailDesigns] = useState<Record<string, SavedDesign>>({});
  const [activeEmailDesign, setActiveEmailDesign] = useState<{
    nodeId: string;
    nodeLabel: string;
    schema?: object | null;
  } | null>(null);
  const [emailFull, setEmailFull] = useState(false);
  const closeEmailDesign = () => { setActiveEmailDesign(null); setEmailFull(false); };

  const handleOpenEmailDesigner = (nodeId: string, nodeLabel: string) => {
    const saved = savedEmailDesigns[nodeId];
    setActiveEmailDesign({ nodeId, nodeLabel: saved?.actorLabel ?? nodeLabel, schema: saved?.schema });
  };

  const handleSaveEmailDesign = (nodeLabel: string, schema: object) => {
    if (!activeEmailDesign) return;
    const { nodeId } = activeEmailDesign;
    setSavedEmailDesigns((prev) => ({ ...prev, [nodeId]: { actorLabel: nodeLabel, schema } }));
    setActiveEmailDesign((prev) => prev ? { ...prev, nodeLabel, schema } : prev);
  };

  // PDF report designer (UserTask)
  const [savedPdfReports, setSavedPdfReports] = useState<Record<string, SavedDesign>>({});
  const [activePdfReport, setActivePdfReport] = useState<{
    nodeId: string;
    nodeLabel: string;
    schema?: object | null;
  } | null>(null);
  const [pdfFull, setPdfFull] = useState(false);
  const closePdfReport = () => { setActivePdfReport(null); setPdfFull(false); };

  const handleOpenPdfDesigner = (nodeId: string, nodeLabel: string) => {
    const saved = savedPdfReports[nodeId];
    setActivePdfReport({ nodeId, nodeLabel: saved?.actorLabel ?? nodeLabel, schema: saved?.schema });
  };

  const handleSavePdfReport = (nodeLabel: string, schema: object) => {
    if (!activePdfReport) return;
    const { nodeId } = activePdfReport;
    setSavedPdfReports((prev) => ({ ...prev, [nodeId]: { actorLabel: nodeLabel, schema } }));
    setActivePdfReport((prev) => prev ? { ...prev, nodeLabel, schema } : prev);
  };

  return (
    <>
      <BpmnEditor
        savedActorForms={savedActorForms}
        onOpenActorForm={handleOpenActorForm}
        onLoadExampleForms={setSavedActorForms}
        savedEmailDesigns={savedEmailDesigns}
        onOpenEmailDesigner={handleOpenEmailDesigner}
        savedPdfReports={savedPdfReports}
        onOpenPdfDesigner={handleOpenPdfDesigner}
      />

      {/* Actor form modal */}
      <Modal
        open={!!activeActorForm}
        onClose={closeActorForm}
        backdropClassName="form-modal-backdrop"
        className="form-modal"
        full={formFull}
        closeOnEscape={false}
      >
        {activeActorForm && (
          <FormBuilder
            actorId={activeActorForm.actorId}
            actorLabel={activeActorForm.actorLabel}
            existingSchema={activeActorForm.schema ?? null}
            currentActor={activeActorForm.currentActor ?? null}
            availableVariables={activeActorForm.availableVariables ?? []}
            maximized={formFull}
            onToggleMaximize={() => setFormFull((v) => !v)}
            onClose={closeActorForm}
            onSave={(schema, actorLabel) =>
              handleSaveActorForm(
                activeActorForm.actorId,
                actorLabel || activeActorForm.actorLabel,
                schema,
              )
            }
          />
        )}
      </Modal>

      {/* Email designer modal */}
      <Modal
        open={!!activeEmailDesign}
        onClose={closeEmailDesign}
        backdropClassName="form-modal-backdrop"
        className="form-modal"
        full={emailFull}
        closeOnEscape={false}
      >
        {activeEmailDesign && (
          <EmailDesigner
            actorId={activeEmailDesign.nodeId}
            actorLabel={activeEmailDesign.nodeLabel}
            existingSchema={activeEmailDesign.schema ?? null}
            maximized={emailFull}
            onToggleMaximize={() => setEmailFull((v) => !v)}
            onClose={closeEmailDesign}
            onSave={(schema, label) => handleSaveEmailDesign(label || activeEmailDesign.nodeLabel, schema)}
          />
        )}
      </Modal>

      {/* PDF report designer modal */}
      <Modal
        open={!!activePdfReport}
        onClose={closePdfReport}
        backdropClassName="form-modal-backdrop"
        className="form-modal"
        full={pdfFull}
        closeOnEscape={false}
      >
        {activePdfReport && (
          <PdfDesigner
            actorId={activePdfReport.nodeId}
            actorLabel={activePdfReport.nodeLabel}
            existingSchema={activePdfReport.schema ?? null}
            maximized={pdfFull}
            onToggleMaximize={() => setPdfFull((v) => !v)}
            onClose={closePdfReport}
            onSave={(schema, label) => handleSavePdfReport(label || activePdfReport.nodeLabel, schema)}
          />
        )}
      </Modal>
    </>
  );
}