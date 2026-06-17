import { Panel } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import type { PendingChoice, SimWait } from "../hooks/useTokenSimulation.ts";

// The interaction menu shown during a token simulation. It surfaces everything
// the sweep is currently waiting on the user for:
//   • Form tasks — click "Fill form" to open the form; submitting it releases
//     the token and feeds its answers into the process variables.
//   • Plain tasks the token has reached — click "Complete" to release it.
//   • Catch events / receive tasks — click "Trigger" to catch the event.
//   • Decision gateways whose conditions didn't resolve — pick which branch the
//     token follows.
// When nothing is pending the sweep runs on its own and the menu is hidden.

type SimulationPanelProps = {
  pending: PendingChoice[];
  waits: SimWait[];
  onChoose: (gatewayId: string, edgeId: string) => void;
  onTrigger: (nodeId: string) => void;
  onOpenForm: (nodeId: string) => void;
};

// A play triangle (complete task) / lightning bolt (catch event) / document
// (fill form) glyph.
const CompleteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden><path d="M4 3l9 5-9 5z" fill="currentColor" /></svg>
);
const CatchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden><path d="M9 1L3 9h4l-1 6 7-9H9z" fill="currentColor" /></svg>
);
const FormIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
    <path d="M4 1h6l3 3v11H4zM10 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 7h5M6 10h5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export default function SimulationPanel({
  pending,
  waits,
  onChoose,
  onTrigger,
  onOpenForm,
}: SimulationPanelProps) {
  const { t } = useTranslation("bpmn");
  if (!pending.length && !waits.length) return null;

  return (
    <Panel position="top-center" className="bf-sim-choices">
      <div className="bf-sim-heading">{t("simulation.waitingTitle")}</div>

      {waits.map((w) => (
        <div key={w.nodeId} className={`bf-sim-choice bf-sim-wait ${w.catch ? "is-catch" : "is-task"}`}>
          <div className="bf-sim-choice-title">
            {t(
              w.catch
                ? "simulation.eventWaiting"
                : w.hasForm
                  ? "simulation.formWaiting"
                  : "simulation.taskWaiting",
              { name: w.name },
            )}
          </div>
          <div className="bf-sim-choice-options">
            {w.hasForm ? (
              <button type="button" className="bf-sim-choice-btn bf-sim-act" onClick={() => onOpenForm(w.nodeId)}>
                <FormIcon />
                {t("simulation.fillForm")}
              </button>
            ) : (
              <button type="button" className="bf-sim-choice-btn bf-sim-act" onClick={() => onTrigger(w.nodeId)}>
                {w.catch ? <CatchIcon /> : <CompleteIcon />}
                {t(w.catch ? "simulation.trigger" : "simulation.complete")}
              </button>
            )}
          </div>
        </div>
      ))}

      {pending.map((choice) => (
        <div key={choice.gatewayId} className="bf-sim-choice">
          <div className="bf-sim-choice-title">
            {t("simulation.choosePath", { gateway: choice.gatewayName })}
          </div>
          <div className="bf-sim-choice-options">
            {choice.options.map((option) => (
              <button
                key={option.edgeId}
                type="button"
                className="bf-sim-choice-btn"
                onClick={() => onChoose(choice.gatewayId, option.edgeId)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}
