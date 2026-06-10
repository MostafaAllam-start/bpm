import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ActorSelectorState } from "../types.ts";

// The persisted form data for one assigned actor: the full selector state minus
// the element id, which is used as the map key instead.
export type SavedActor = Omit<ActorSelectorState, "actorId">;

type ActorStoreState = {
  // Saved actor selections keyed by the BPMN element id.
  actors: Record<string, SavedActor>;
  saveActor: (state: ActorSelectorState) => void;
  getActor: (actorId: string) => SavedActor | undefined;
  removeActor: (actorId: string) => void;
};

// Holds the actor-form data the user assigns to diagram elements. Persisted to
// localStorage so a selection survives closing the form (and reloads), which is
// what lets the "Assign actor" form reopen with the previous choice instead of
// resetting. The choice is still mirrored onto the BPMN element on save so the
// canvas label and exports keep working.
export const useActorStore = create<ActorStoreState>()(
  persist(
    (set, get) => ({
      actors: {},
      saveActor: ({ actorId, ...data }) =>
        set((state) => ({
          actors: { ...state.actors, [actorId]: data },
        })),
      getActor: (actorId) => get().actors[actorId],
      removeActor: (actorId) =>
        set((state) => {
          const actors = { ...state.actors };
          delete actors[actorId];
          return { actors };
        }),
    }),
    {
      name: "ecmplus-actors",
      partialize: (state) => ({ actors: state.actors }),
    },
  ),
);
