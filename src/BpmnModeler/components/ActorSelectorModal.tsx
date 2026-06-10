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
  return (
    <div className="actor-popup-backdrop" onClick={onClose}>
      <div
        className="actor-popup-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Assign actor</h2>
        <ActorFilters state={actorSelector} controls={controls} />
        <div className="actor-popup-actions">
          <button type="button" onClick={onConfirm} disabled={!canSave}>
            Save actor
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
