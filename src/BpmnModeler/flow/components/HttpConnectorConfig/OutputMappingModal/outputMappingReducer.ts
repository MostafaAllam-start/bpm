import type { HttpOutputRule } from "../../../types/index.ts";

// State and reducer for the OutputMappingModal. All mutations go through
// dispatch so the component stays declarative and the logic is testable.

export type OutMapState = {
  rules: HttpOutputRule[];
};

export type OutMapAction =
  | { type: "ADD" }
  | { type: "REMOVE"; id: string }
  | { type: "MOVE_UP"; idx: number }
  | { type: "MOVE_DOWN"; idx: number }
  | { type: "PATCH"; id: string; changes: Partial<HttpOutputRule> }
  | { type: "RESET"; rules: HttpOutputRule[] };

function newRule(): HttpOutputRule {
  return { id: crypto.randomUUID(), targetVar: "", condition: "", value: "" };
}

export const OUT_MAP_INIT: OutMapState = { rules: [] };

export function outMapReducer(state: OutMapState, action: OutMapAction): OutMapState {
  switch (action.type) {
    case "ADD":
      return { rules: [...state.rules, newRule()] };

    case "REMOVE":
      return { rules: state.rules.filter((r) => r.id !== action.id) };

    case "MOVE_UP": {
      if (action.idx === 0) return state;
      const next = [...state.rules];
      [next[action.idx - 1], next[action.idx]] = [next[action.idx], next[action.idx - 1]];
      return { rules: next };
    }

    case "MOVE_DOWN": {
      if (action.idx >= state.rules.length - 1) return state;
      const next = [...state.rules];
      [next[action.idx], next[action.idx + 1]] = [next[action.idx + 1], next[action.idx]];
      return { rules: next };
    }

    case "PATCH":
      return {
        rules: state.rules.map((r) =>
          r.id === action.id ? { ...r, ...action.changes } : r,
        ),
      };

    case "RESET":
      return { rules: [...action.rules] };
  }
}
