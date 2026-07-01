import { useReducer } from "react";
import { useTranslation } from "react-i18next";

import { getByPath } from "@FormBuilder";
import type { SimWait } from "../../hooks/useTokenSimulation";
import type { BpmnNode, BpmnNodeData } from "../../types";
import {
  parseRequests,
  fetchHttpConnector,
  evaluateOutputRules,
  interpolate,
} from "../../utils/httpConnector";
import { httpSimReducer, HTTP_SIM_INIT } from "./httpSimReducer";

type Props = {
  wait: SimWait;
  nodes: BpmnNode[];
  variables: Record<string, unknown>;
  onComplete: (nodeId: string, outputVars: Record<string, string>) => void;
};

export default function SimulationHttpPanel({ wait, nodes, variables, onComplete }: Props) {
  const { t } = useTranslation("bpmn");
  const [state, dispatch] = useReducer(httpSimReducer, HTTP_SIM_INIT);

  const node = nodes.find((n) => n.id === wait.nodeId);
  const nodeProps = (node?.data as BpmnNodeData | undefined)?.props ?? {};
  const requests = parseRequests(nodeProps.httpRequests, nodeProps);
  const request = requests[0] ?? null;

  const doFetch = async () => {
    if (!request?.url.trim()) return;
    dispatch({ type: "FETCH_START" });
    const resolvedUrl = interpolate(request.url, variables);
    const resolvedBody = request.body ? interpolate(request.body, variables) : "";
    const result = await fetchHttpConnector(request.method, resolvedUrl, request.headers, resolvedBody);
    if (!result.ok) {
      dispatch({ type: "FETCH_ERROR", errorMsg: result.error });
      return;
    }
    const extracted = request.responsePath
      ? getByPath(result.json, request.responsePath)
      : result.json;
    const outputVars = evaluateOutputRules(request.outputRules, extracted, variables);
    dispatch({ type: "FETCH_OK", text: result.text, json: extracted, outputVars });
  };

  const { phase, responseText, errorMsg, outputVars } = state;
  const resolvedUrl = request ? interpolate(request.url, variables) : "";

  return (
    <div className="bf-http-sim">
      <div className="bf-sim-choice-title">
        {t("simulation.taskWaiting", { name: wait.name })}
      </div>

      {request && (
        <div className="bf-http-sim-url">
          <span className="bf-http-sim-method">{request.method}</span>
          <span className="bf-http-sim-urltext" title={resolvedUrl}>
            {resolvedUrl || "—"}
          </span>
        </div>
      )}

      <div className="bf-sim-choice-options">
        <button
          type="button"
          className="bf-sim-choice-btn bf-sim-act"
          disabled={!resolvedUrl.trim() || phase === "loading"}
          onClick={() => { void doFetch(); }}
        >
          {phase === "loading" ? t("props.httpTesting") : t("props.httpTest")}
        </button>
      </div>

      {phase === "error" && <p className="bf-http-sim-error">{errorMsg}</p>}

      {phase === "ok" && (
        <>
          <div className="bf-http-sim-section">{t("props.httpSimResponse")}</div>
          <textarea className="bf-http-sim-response" rows={5} readOnly value={responseText} />

          {Object.keys(outputVars).length > 0 && (
            <>
              <div className="bf-http-sim-section">{t("props.httpSimOutputs")}</div>
              <div className="bf-http-sim-outputs">
                {Object.entries(outputVars).map(([k, v]) => (
                  <div key={k} className="bf-http-sim-output-row">
                    <span className="bf-http-sim-var-name">{k}</span>
                    <span className="bf-http-sim-var-sep"> = </span>
                    <span className="bf-http-sim-var-value">{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="bf-sim-choice-options" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="bf-sim-choice-btn bf-sim-act"
              onClick={() => onComplete(wait.nodeId, outputVars)}
            >
              {t("simulation.complete")}
            </button>
          </div>
        </>
      )}

      {phase !== "ok" && (
        <div className="bf-http-sim-skip">
          <button
            type="button"
            className="bf-sim-choice-btn"
            onClick={() => onComplete(wait.nodeId, {})}
          >
            {t("simulation.complete")}
          </button>
        </div>
      )}
    </div>
  );
}
