import { useTranslation } from "react-i18next";

import type { ActorControls, ActorSelectorState } from "../types.ts";
import ActorFilters from "./ActorFilters.tsx";

type ActorSelectorModalProps = {
  actorSelector: ActorSelectorState;
  controls: ActorControls;
  // Whether the current selection is complete enough to save.
  canSave: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

// Modal shell that hosts the cascading actor filters plus Save / Cancel.
export default function ActorSelectorModal({
  actorSelector,
  controls,
  canSave,
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
        <h2>{t("selector.title")}</h2>
        <ActorFilters state={actorSelector} controls={controls} />
        <div className="actor-popup-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={!canSave}
          >
            {t("selector.save")}
          </button>
          <button type="button" onClick={onClose}>
            {t("selector.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
