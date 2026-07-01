import { useEffect } from "react";

// Global keyboard shortcuts for the designer. Node/edge deletion is left to
// React Flow's own `deleteKeyCode`; this covers the editing commands React Flow
// doesn't: undo/redo, copy/paste, duplicate. Shortcuts are ignored while the
// user is typing in a form field so they don't hijack text editing.

export type ShortcutHandlers = {
  undo: () => void;
  redo: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useWorkflowShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      switch (key) {
        case "z":
          event.preventDefault();
          if (event.shiftKey) handlers.redo();
          else handlers.undo();
          break;
        case "y":
          event.preventDefault();
          handlers.redo();
          break;
        case "c":
          event.preventDefault();
          handlers.copy();
          break;
        case "v":
          event.preventDefault();
          handlers.paste();
          break;
        case "d":
          event.preventDefault();
          handlers.duplicate();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
