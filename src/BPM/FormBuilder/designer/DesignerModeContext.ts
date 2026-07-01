import { createContext, useContext } from "react";

export type DesignerMode = "form" | "email" | "pdf";

export const DesignerModeContext = createContext<DesignerMode>("form");

export function useDesignerMode(): DesignerMode {
  return useContext(DesignerModeContext);
}
