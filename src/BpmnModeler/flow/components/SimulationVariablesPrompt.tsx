import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { GlobalVariable } from "../types/index.ts";
import { coerceVariableValue } from "../utils/variables.ts";

// Shown when a simulation starts on a process that declares global variables:
// the run pauses here until the user supplies their values. Each field is
// pre-filled with the variable's declared default; on start the raw inputs are
// coerced to their declared types and handed to the sweep as the initial store.

type SimulationVariablesPromptProps = {
  variables: GlobalVariable[];
  onStart: (values: Record<string, unknown>) => void;
  onCancel: () => void;
};

export default function SimulationVariablesPrompt({
  variables,
  onStart,
  onCancel,
}: SimulationVariablesPromptProps) {
  const { t } = useTranslation("bpmn");
  // Raw per-variable input strings, seeded from the declared defaults.
  const [raw, setRaw] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of variables) init[v.name] = v.defaultValue ?? "";
    return init;
  });

  const setValue = (name: string, value: string) =>
    setRaw((prev) => ({ ...prev, [name]: value }));

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
            return (
              <label key={v.name} className="bf-prop-field" htmlFor={id}>
                <span className="bf-prop-label">
                  {v.name}
                  <span className="bf-var-chip-type"> {t(`props.varTypes.${v.type}`)}</span>
                </span>
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
