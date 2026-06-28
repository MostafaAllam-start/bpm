import { useState } from "react";

export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (next: T[]) => void,
) {
  const [dragFrom, setDragFrom] = useState<{ id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ beforeId: string | null } | null>(null);

  const dragHandleProps = (id: string) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => setDragFrom({ id }), 0);
    },
    onDragEnd: () => {
      setDragFrom(null);
      setDropTarget(null);
    },
  });

  const dropSlotProps = (beforeId: string | null) => ({
    className: `bf-req-drop-slot${
      dragFrom && dropTarget?.beforeId === beforeId && dragFrom.id !== beforeId
        ? " is-active"
        : ""
    }`,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget({ beforeId });
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragFrom || dragFrom.id === beforeId) {
        setDragFrom(null);
        setDropTarget(null);
        return;
      }
      const dragged = items.find((r) => r.id === dragFrom.id);
      if (!dragged) return;
      const without = items.filter((r) => r.id !== dragFrom.id);
      if (beforeId === null) {
        onReorder([...without, dragged]);
      } else {
        const idx = without.findIndex((r) => r.id === beforeId);
        without.splice(Math.max(0, idx), 0, dragged);
        onReorder(without);
      }
      setDragFrom(null);
      setDropTarget(null);
    },
  });

  return {
    dragFrom,
    isDragging: (id: string) => dragFrom?.id === id,
    dragHandleProps,
    dropSlotProps,
  };
}
