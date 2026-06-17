import { useTranslation } from "react-i18next";

import FormRenderer from "../../../forms/FormRenderer.tsx";
import { isFormSchema } from "../../../forms/types.ts";
import type { FormValues } from "../../../forms/types.ts";
import type { SavedActorForm } from "../../types.ts";

// The form a simulated task presents. While the token sits on a form task, this
// modal shows that task's form; submitting it (passing validation) hands the
// answers back so they merge into the process variables and the token advances.
// Cancelling leaves the token waiting so the user can reopen and fill it later.

type SimulationFormModalProps = {
  nodeId: string;
  saved: SavedActorForm;
  onSubmit: (nodeId: string, values: FormValues) => void;
  onCancel: () => void;
};

export default function SimulationFormModal({
  nodeId,
  saved,
  onSubmit,
  onCancel,
}: SimulationFormModalProps) {
  const { t, i18n } = useTranslation("bpmn");
  if (!isFormSchema(saved.schema)) return null;

  return (
    <div className="bf-sim-form-backdrop" onClick={onCancel}>
      <div className="bf-sim-form-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bf-sim-form-head">
          <span className="bf-sim-form-actor">{saved.actorLabel || nodeId}</span>
          <button type="button" className="bf-sim-form-close" aria-label={t("selector.cancel")} onClick={onCancel}>
            ×
          </button>
        </header>
        <div className="bf-sim-form-body">
          <FormRenderer
            schema={saved.schema}
            locale={i18n.language}
            onSubmit={(values) => onSubmit(nodeId, values)}
          />
        </div>
      </div>
    </div>
  );
}
