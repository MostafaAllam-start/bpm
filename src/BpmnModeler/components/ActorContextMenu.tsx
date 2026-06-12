import { useTranslation } from "react-i18next";

import type { ContextMenuState } from "../types.ts";

type ActorContextMenuProps = {
  contextMenu: ContextMenuState;
  hasSavedForm: boolean;
  onCreateForm: (actorId: string, actorLabel: string) => void;
  onSelectActor: (actorId: string) => void;
};

// Right-click menu shown over an actor element, anchored at the click position.
export default function ActorContextMenu({
  contextMenu,
  hasSavedForm,
  onCreateForm,
  onSelectActor,
}: ActorContextMenuProps) {
  const { t } = useTranslation("bpmn");
  return (
    <div
      className="actor-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onCreateForm(contextMenu.actorId, contextMenu.actorLabel)}
      >
        {hasSavedForm ? t("contextMenu.updateForm") : t("contextMenu.addForm")}
      </button>
      <button type="button" onClick={() => onSelectActor(contextMenu.actorId)}>
        {t("contextMenu.selectActor")}
      </button>
    </div>
  );
}
