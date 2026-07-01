export type FetchPhase = "idle" | "loading" | "ok" | "error";

export type HttpSimState = {
  phase: FetchPhase;
  responseText: string;
  responseJson: unknown;
  errorMsg: string;
  outputVars: Record<string, string>;
};

export type HttpSimAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_OK"; text: string; json: unknown; outputVars: Record<string, string> }
  | { type: "FETCH_ERROR"; errorMsg: string };

export const HTTP_SIM_INIT: HttpSimState = {
  phase: "idle",
  responseText: "",
  responseJson: undefined,
  errorMsg: "",
  outputVars: {},
};

export function httpSimReducer(_state: HttpSimState, action: HttpSimAction): HttpSimState {
  switch (action.type) {
    case "FETCH_START":
      return { ...HTTP_SIM_INIT, phase: "loading" };
    case "FETCH_OK":
      return {
        phase: "ok",
        responseText: action.text,
        responseJson: action.json,
        errorMsg: "",
        outputVars: action.outputVars,
      };
    case "FETCH_ERROR":
      return { ...HTTP_SIM_INIT, phase: "error", errorMsg: action.errorMsg };
  }
}
