import { create } from "zustand";

import type { ValidationIssue, ValidationResult } from "../services/validation.ts";

// Holds the latest validation result so two consumers can read it independently:
// the validation panel (the flat issue list) and each node component (its own
// issues, for the error badge), without prop-drilling through React Flow.

type ValidationState = {
  issues: ValidationIssue[];
  byNode: Record<string, ValidationIssue[]>;
  ok: boolean;
  setResult: (result: ValidationResult) => void;
};

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],
  byNode: {},
  ok: true,
  setResult: (result) => set({ issues: result.issues, byNode: result.byNode, ok: result.ok }),
}));
