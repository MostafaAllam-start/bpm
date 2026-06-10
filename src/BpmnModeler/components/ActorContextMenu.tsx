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
        {hasSavedForm ? "Update form" : "Add form"}
      </button>
      <button type="button" onClick={() => onSelectActor(contextMenu.actorId)}>
        Select actor
      </button>
    </div>
  );
}
