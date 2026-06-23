import { useTranslation } from "react-i18next";

import Modal from "@shared/Modal";
import { FormRenderer, isFormSchema, type FormValues } from "@FormBuilder";
import type { SavedActorForm } from "../../types.ts";

// The form a simulated task presents. While the token sits on a form task, this
// modal shows that task's form; submitting it (passing validation) hands the
// answers back so they merge into the process variables and the token advances.
// Cancelling leaves the token waiting so the user can reopen and fill it later.

type SimulationFormModalProps = {
  nodeId: string;
  saved: SavedActorForm;
  // The live process variable store, so the form's dynamic-text fields can
  // resolve `{name}` tokens against process globals and upstream-form answers.
  variables?: Record<string, unknown>;
  onSubmit: (nodeId: string, values: FormValues) => void;
  onCancel: () => void;
};

export default function SimulationFormModal({
  nodeId,
  saved,
  variables,
  onSubmit,
  onCancel,
}: SimulationFormModalProps) {
  const { t, i18n } = useTranslation("bpmn");
  if (!isFormSchema(saved.schema)) return null;
  const schema = saved.schema;

  return (
    <Modal
      open
      onClose={onCancel}
      backdropClassName="bf-sim-form-backdrop"
      className="bf-sim-form-modal"
      labelledBy="bf-sim-form-title"
    >
      <header className="bf-sim-form-head">
        <span id="bf-sim-form-title" className="bf-sim-form-actor">{saved.actorLabel || nodeId}</span>
        <button type="button" className="bf-sim-form-close" aria-label={t("selector.cancel")} onClick={onCancel}>
          ×
        </button>
      </header>
      <div className="bf-sim-form-body">
        <FormRenderer
          schema={schema}
          locale={i18n.language}
          variables={variables}
          onSubmit={(values) => onSubmit(nodeId, values)}
        />
      </div>
    </Modal>
  );
}
