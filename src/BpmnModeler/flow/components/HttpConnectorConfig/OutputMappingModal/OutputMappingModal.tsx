import { useReducer, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import BpmnModal from "../../BpmnModal/index.ts";
import VarMentionInput from "../VarMentionInput.tsx";
import type { HttpOutputRule, HttpRequest } from "../../../types/index.ts";
import type { AvailableVariable } from "../../../utils/variables.ts";
import {
  fetchHttpConnector,
  interpolate,
  evaluateAllOutputRules,
} from "../../../utils/httpConnector.ts";
import { getByPath } from "@FormBuilder";
import { outMapReducer, OUT_MAP_INIT } from "./outputMappingReducer.ts";

type TestState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; error: string }
  | { phase: "ok"; text: string; results: Record<string, string> };

type OutputMappingModalProps = {
  open: boolean;
  request: HttpRequest;
  allRequests: HttpRequest[];
  availableVars: AvailableVariable[];
  processVars?: Record<string, unknown>;
  onApply: (rules: HttpOutputRule[]) => void;
  onClose: () => void;
};

// Build AvailableVariable entries from the actual response JSON so that field
// paths (e.g. `responseVar.status`, `responseVar[0].name`) appear in the
// mention dropdown after a successful test request.
function discoverResponseVars(
  responseVar: string,
  requestName: string,
  extracted: unknown,
): AvailableVariable[] {
  const discovered: AvailableVariable[] = [];
  if (Array.isArray(extracted)) {
    discovered.push({
      name: `${responseVar}.length`, ref: `${responseVar}.length`,
      type: "number", origin: "task", source: requestName,
    });
    if (extracted.length > 0 && extracted[0] && typeof extracted[0] === "object") {
      for (const key of Object.keys(extracted[0] as object)) {
        discovered.push({
          name: `${responseVar}[0].${key}`, ref: `${responseVar}[0].${key}`,
          type: "string", origin: "task", source: requestName,
        });
      }
    }
  } else if (extracted && typeof extracted === "object") {
    for (const key of Object.keys(extracted as object)) {
      discovered.push({
        name: `${responseVar}.${key}`, ref: `${responseVar}.${key}`,
        type: "string", origin: "task", source: requestName,
      });
    }
  }
  return discovered;
}

export default function OutputMappingModal({
  open,
  request,
  allRequests,
  availableVars,
  processVars = {},
  onApply,
  onClose,
}: OutputMappingModalProps) {
  const { t } = useTranslation("bpmn");
  const [state, dispatch] = useReducer(outMapReducer, OUT_MAP_INIT);
  const [discoveredVars, setDiscoveredVars] = useState<AvailableVariable[]>([]);
  const [test, setTest] = useState<TestState>({ phase: "idle" });

  const { rules } = state;

  const doTest = async (rulesOverride?: HttpOutputRule[]) => {
    setTest({ phase: "loading" });
    try {
      const rulesToUse = rulesOverride ?? rules;
      const url = interpolate(request.url, processVars);
      if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
        setTest({ phase: "error", error: t("props.httpInvalidUrl") });
        return;
      }
      const body = request.body ? interpolate(request.body, processVars) : "";
      const result = await fetchHttpConnector(request.method, url, request.headers, body);
      if (!result.ok) {
        setTest({ phase: "error", error: result.error });
        return;
      }
      const extracted = request.responsePath
        ? getByPath(result.json, request.responsePath)
        : result.json;
      const results = evaluateAllOutputRules(
        [{ request: { ...request, outputRules: rulesToUse }, json: extracted }],
        processVars,
      );
      if (request.responseVar) {
        setDiscoveredVars(discoverResponseVars(request.responseVar, request.name, extracted));
      }
      setTest({ phase: "ok", text: JSON.stringify(extracted, null, 2), results });
    } catch (err) {
      setTest({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  };

  // Reset rules + auto-send on open or when switching requests.
  // Pass outputRules from props directly to avoid stale-closure on state.
  useEffect(() => {
    dispatch({ type: "RESET", rules: request.outputRules });
    setDiscoveredVars([]);
    if (open && request.url.trim()) {
      void doTest(request.outputRules);
    } else {
      setTest({ phase: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request.id]);

  const mergedVars = useMemo(
    () => [...availableVars, ...discoveredVars],
    [availableVars, discoveredVars],
  );

  const globalVars = availableVars.filter((v) => v.origin === "global");
  const taskVars = availableVars.filter((v) => v.origin === "task");

  return (
    <BpmnModal
      open={open}
      title={t("props.httpOutputRules")}
      subtitle={request.name}
      onClose={onClose}
      onApply={() => onApply(rules)}
    >
      <div className="bf-outmap-layout">
        {/* ── Rules list ── */}
        <div className="bf-outmap-rules">
          <p className="bf-http-hint">{t("props.httpOutputRulesHint")}</p>

          {rules.map((rule, idx) => (
            <div key={rule.id} className="bf-outmap-rule">
              <div className="bf-outmap-rule-controls">
                <button
                  type="button"
                  className="bf-http-move-btn"
                  disabled={idx === 0}
                  onClick={() => dispatch({ type: "MOVE_UP", idx })}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="bf-http-move-btn"
                  disabled={idx === rules.length - 1}
                  onClick={() => dispatch({ type: "MOVE_DOWN", idx })}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="bf-http-row-remove"
                  onClick={() => dispatch({ type: "REMOVE", id: rule.id })}
                  title={t("props.conditionRemove")}
                >
                  ×
                </button>
              </div>

              <div className="bf-outmap-rule-fields">
                <div className="bf-outmap-row">
                  <span className="bf-outmap-label">{t("props.httpRuleTarget")}</span>
                  <VarMentionInput
                    className="bf-outmap-input"
                    value={rule.targetVar}
                    placeholder={t("props.httpRuleTargetHint")}
                    availableVars={mergedVars}
                    onChange={(v) =>
                      dispatch({ type: "PATCH", id: rule.id, changes: { targetVar: v } })
                    }
                  />
                </div>

                <div className="bf-outmap-row">
                  <span className="bf-outmap-label">{t("props.httpRuleCondition")}</span>
                  <VarMentionInput
                    className="bf-outmap-input"
                    value={rule.condition}
                    placeholder={t("props.httpRuleConditionPlaceholder")}
                    availableVars={mergedVars}
                    onChange={(v) =>
                      dispatch({ type: "PATCH", id: rule.id, changes: { condition: v } })
                    }
                  />
                </div>

                <div className="bf-outmap-row">
                  <span className="bf-outmap-label">{t("props.httpRuleValue")}</span>
                  <VarMentionInput
                    className="bf-outmap-input"
                    value={rule.value}
                    placeholder={t("props.httpRuleValuePlaceholder")}
                    availableVars={mergedVars}
                    onChange={(v) =>
                      dispatch({ type: "PATCH", id: rule.id, changes: { value: v } })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="bf-http-add-btn"
            onClick={() => dispatch({ type: "ADD" })}
          >
            + {t("props.httpAddRule")}
          </button>

          {/* ── Response section (auto-triggered on open) ── */}
          <div className="bf-outmap-test">
            {test.phase === "loading" && (
              <p className="bf-outmap-test-loading">{t("props.httpTesting")}</p>
            )}

            {test.phase === "error" && (
              <div className="bf-outmap-test-error-block">
                <p className="bf-outmap-test-error">{test.error}</p>
                <button
                  type="button"
                  className="bf-outmap-test-retry-btn"
                  onClick={() => { void doTest(); }}
                >
                  {t("props.httpRetry")}
                </button>
              </div>
            )}

            {test.phase === "ok" && (
              <>
                <div className="bf-outmap-test-section">{t("props.httpSimResponse")}</div>
                <pre className="bf-outmap-test-response" dir="ltr">{test.text}</pre>

                {discoveredVars.length > 0 && (
                  <p className="bf-outmap-test-hint">{t("props.httpVarsDiscovered")}</p>
                )}

                {Object.keys(test.results).length > 0 && (
                  <>
                    <div className="bf-outmap-test-section">{t("props.httpSimOutputs")}</div>
                    <div className="bf-outmap-test-results">
                      {Object.entries(test.results).map(([k, v]) => (
                        <div key={k} className="bf-outmap-test-row">
                          <span className="bf-outmap-test-var">{k}</span>
                          <span className="bf-outmap-test-sep">=</span>
                          <span className="bf-outmap-test-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Variable hint panel ── */}
        <div className="bf-outmap-vars">
          <div className="bf-outmap-vars-title">{t("props.availableVariables")}</div>

          {allRequests.map((req) => (
            <div key={req.id} className="bf-outmap-var-group">
              <div className="bf-outmap-var-group-label">{req.name}</div>
              {req.responseVar && (
                <>
                  <div className="bf-outmap-var-chip" title={t("props.httpResponseVar")}>
                    {`{${req.responseVar}}`}
                  </div>
                  <div className="bf-outmap-var-chip" title={t("props.httpResponseVarField")}>
                    {req.isList
                      ? `{${req.responseVar}.length}`
                      : `{${req.responseVar}.fieldName}`}
                  </div>
                  {req.isList && (
                    <div className="bf-outmap-var-chip" title={t("props.httpResponseVarItem")}>
                      {`{${req.responseVar}[0].fieldName}`}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {globalVars.length > 0 && (
            <div className="bf-outmap-var-group">
              <div className="bf-outmap-var-group-label">{t("props.varCategory.process")}</div>
              {globalVars.map((v) => (
                <div key={v.ref} className="bf-outmap-var-chip">{`{${v.name}}`}</div>
              ))}
            </div>
          )}

          {taskVars.length > 0 && (
            <div className="bf-outmap-var-group">
              <div className="bf-outmap-var-group-label">{t("props.varCategory.form")}</div>
              {taskVars.map((v) => (
                <div key={v.ref} className="bf-outmap-var-chip" title={v.source ?? ""}>
                  {`{${v.name}}`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BpmnModal>
  );
}
