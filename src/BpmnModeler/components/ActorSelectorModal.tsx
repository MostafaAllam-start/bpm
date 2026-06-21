import { useTranslation } from "react-i18next";

import type { ActorControls, ActorSelectorState } from "../types.ts";
import type { AvailableVariable } from "../flow/utils/variables.ts";
import ActorFilters from "./ActorFilters.tsx";

type ActorSelectorModalProps = {
  actorSelector: ActorSelectorState;
  controls: ActorControls;
  // Variables in scope where the selector was opened, offered as the source for
  // a "custom" actor.
  availableVariables?: AvailableVariable[];
  // Whether the current selection is complete enough to save.
  canSave: boolean;
  // Heading + confirm-button text, so the same modal serves both task
  // assignment ("Assign actor" / "Save actor") and the process-level allowed
  // actors list ("Add allowed actor" / "Add"). Defaults to the assignment copy.
  title?: string;
  saveLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

// Modal shell that hosts the cascading actor filters plus Save / Cancel.
export default function ActorSelectorModal({
  actorSelector,
  controls,
  availableVariables,
  canSave,
  title,
  saveLabel,
  onClose,
  onConfirm,
}: ActorSelectorModalProps) {
  const { t } = useTranslation("bpmn");
  return (
    <div className="actor-popup-backdrop" onClick={onClose}>
      <div
        className="actor-popup-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title ?? t("selector.title")}</h2>
        <ActorFilters
          state={actorSelector}
          controls={controls}
          availableVariables={availableVariables ?? []}
        />
        <div className="actor-popup-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={!canSave}
          >
            {saveLabel ?? t("selector.save")}
          </button>
          <button type="button" onClick={onClose}>
            {t("selector.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
