import { Panel } from "@xyflow/react";
import { useTranslation } from "react-i18next";

// A live readout of the process variable store during a token simulation: the
// process-global variables plus every answer submitted through a task's form,
// shown so the user can see the data the gateway conditions are evaluated
// against at each step. Hidden when the sim isn't running or has no variables.

type SimulationVariablesProps = {
  variables: Record<string, unknown>;
};

// Render a stored value compactly for display (arrays as comma lists, objects
// as JSON, everything else as a string).
function show(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SimulationVariables({ variables }: SimulationVariablesProps) {
  const { t } = useTranslation("bpmn");
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <Panel position="bottom-left" className="bf-sim-vars">
      <div className="bf-sim-vars-title">{t("simulation.variablesTitle")}</div>
      <div className="bf-sim-vars-list">
        {entries.map(([name, value]) => (
          <div key={name} className="bf-sim-var-row">
            <span className="bf-sim-var-name">{name}</span>
            <span className="bf-sim-var-value">{show(value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
