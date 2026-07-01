import { create } from "zustand";

// One-shot signal from the ValidationPanel to the PropertiesPanel: which
// section to scroll into view after clearing the canvas selection.  Consumed
// once (clear() is called right after scrolling).
type State = {
  section: string | null;
  request: (section: string) => void;
  clear: () => void;
};

export const usePropertiesFocusStore = create<State>((set) => ({
  section: null,
  request: (section) => set({ section }),
  clear: () => set({ section: null }),
}));
