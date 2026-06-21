import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GlobalVariable } from "../types/index.ts";
import { coerceVariableValue, fetchApiVariableValue } from "../utils/variables.ts";

// Shown when a simulation starts on a process that declares global variables:
// the run pauses here until the user supplies their values. Manual variables are
// typed in; API variables auto-fetch from their configured endpoint on open and
// can be refetched or edited. On start the raw inputs are coerced to their
// declared types and handed to the sweep as the initial store.

type SimulationVariablesPromptProps = {
  variables: GlobalVariable[];
  onStart: (values: Record<string, unknown>) => void;
  onCancel: () => void;
};

// Per-variable fetch state for API-sourced variables.
type FetchState = "idle" | "loading" | "error";

export default function SimulationVariablesPrompt({
  variables,
  onStart,
  onCancel,
}: SimulationVariablesPromptProps) {
  const { t } = useTranslation("bpmn");
  // Raw per-variable input strings, supplied here at creation. "actor" variables
  // start from their optional design-time default; "api" variables start empty
  // and are filled by the auto-fetch below.
  const [raw, setRaw] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of variables) {
      if ((v.source ?? "manual") === "actor") init[v.name] = v.value ?? "";
    }
    return init;
  });
  const [fetchState, setFetchState] = useState<Record<string, FetchState>>({});

  const setValue = (name: string, value: string) =>
    setRaw((prev) => ({ ...prev, [name]: value }));

  // Pull one API variable's value from its endpoint and drop it into the input.
  const fetchValue = useCallback(async (v: GlobalVariable) => {
    if (!v.api?.url) return;
    setFetchState((prev) => ({ ...prev, [v.name]: "loading" }));
    try {
      const value = await fetchApiVariableValue(v.api, v.type);
      setRaw((prev) => ({ ...prev, [v.name]: value }));
      setFetchState((prev) => ({ ...prev, [v.name]: "idle" }));
    } catch {
      setFetchState((prev) => ({ ...prev, [v.name]: "error" }));
    }
  }, []);

  // Auto-fetch every API variable once when the prompt opens. The fetch is a
  // genuine external-system sync; its loading-state write is intentional.
  useEffect(() => {
    for (const v of variables) {
      if ((v.source ?? "manual") !== "api" || !v.api?.url) continue;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchValue(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    const values: Record<string, unknown> = {};
    for (const v of variables) {
      values[v.name] = coerceVariableValue(v.type, raw[v.name] ?? "");
    }
    onStart(values);
  };

  return (
    <div className="bf-sim-form-backdrop" onClick={onCancel}>
      <div className="bf-sim-form-modal bf-sim-vars-prompt" onClick={(e) => e.stopPropagation()}>
        <header className="bf-sim-form-head">
          <span className="bf-sim-form-actor">{t("simulation.enterVariablesTitle")}</span>
          <button type="button" className="bf-sim-form-close" aria-label={t("selector.cancel")} onClick={onCancel}>
            ×
          </button>
        </header>

        <div className="bf-sim-form-body">
          <p className="bf-var-hint">{t("simulation.enterVariablesHint")}</p>

          {variables.map((v) => {
            const id = `bf-sim-var-${v.name}`;
            const value = raw[v.name] ?? "";
            const isApi = (v.source ?? "manual") === "api";
            const state = fetchState[v.name] ?? "idle";
            return (
              <label key={v.name} className="bf-prop-field" htmlFor={id}>
                <span className="bf-prop-label">
                  {v.name}
                  <span className="bf-var-chip-type"> {t(`props.varTypes.${v.type}`)}</span>
                </span>
                <div className="bf-sim-var-input-row">
                  {v.type === "boolean" ? (
                    <select id={id} value={value} onChange={(e) => setValue(v.name, e.target.value)}>
                      <option value="true">{t("props.varTypes.boolean")}: true</option>
                      <option value="false">{t("props.varTypes.boolean")}: false</option>
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={v.type === "number" ? "number" : v.type === "date" ? "date" : "text"}
                      value={value}
                      placeholder={v.type === "array" ? "a, b, c" : undefined}
                      onChange={(e) => setValue(v.name, e.target.value)}
                    />
                  )}
                  {isApi && (
                    <button
                      type="button"
                      className="bf-sim-var-fetch"
                      disabled={state === "loading" || !v.api?.url}
                      onClick={() => void fetchValue(v)}
                    >
                      {state === "loading" ? t("simulation.fetching") : t("simulation.fetchValue")}
                    </button>
                  )}
                </div>
                {isApi && state === "error" && (
                  <span className="bf-var-error">{t("simulation.fetchError")}</span>
                )}
              </label>
            );
          })}
        </div>

        <footer className="bf-sim-form-foot">
          <button type="button" className="bf-sim-choice-btn" onClick={onCancel}>
            {t("selector.cancel")}
          </button>
          <button type="button" className="bf-sim-choice-btn bf-sim-start-btn" onClick={handleStart}>
            {t("simulation.startRun")}
          </button>
        </footer>
      </div>
    </div>
  );
}
