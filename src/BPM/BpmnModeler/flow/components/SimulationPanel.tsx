import { Panel } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import type { PendingChoice, SimWait } from "../hooks/useTokenSimulation.ts";
import type { BpmnNode } from "../types/index.ts";
import { SimCompleteIcon, SimCatchIcon, SimFormIcon } from "./icons/index.ts";
import SimulationHttpPanel from "./SimulationHttpPanel/index.ts";

// The interaction menu shown during a token simulation. It surfaces everything
// the sweep is currently waiting on the user for:
//   • HTTP connector tasks — fetch the endpoint, evaluate output rules, complete.
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
  nodes: BpmnNode[];
  variables: Record<string, unknown>;
  onChoose: (gatewayId: string, edgeId: string) => void;
  onTrigger: (nodeId: string) => void;
  onOpenForm: (nodeId: string) => void;
  onCompleteHttp: (nodeId: string, outputVars: Record<string, string>) => void;
};

export default function SimulationPanel({
  pending,
  waits,
  nodes,
  variables,
  onChoose,
  onTrigger,
  onOpenForm,
  onCompleteHttp,
}: SimulationPanelProps) {
  const { t } = useTranslation("bpmn");
  if (!pending.length && !waits.length) return null;

  return (
    <Panel position="top-center" className="bf-sim-choices">
      <div className="bf-sim-heading">{t("simulation.waitingTitle")}</div>

      {waits.map((w) => {
        if (w.bpmnType === "httpConnectorTask") {
          return (
            <div key={w.nodeId} className="bf-sim-choice bf-sim-wait is-task">
              <SimulationHttpPanel
                wait={w}
                nodes={nodes}
                variables={variables}
                onComplete={onCompleteHttp}
              />
            </div>
          );
        }

        return (
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
                  <SimFormIcon />
                  {t("simulation.fillForm")}
                </button>
              ) : (
                <button type="button" className="bf-sim-choice-btn bf-sim-act" onClick={() => onTrigger(w.nodeId)}>
                  {w.catch ? <SimCatchIcon /> : <SimCompleteIcon />}
                  {t(w.catch ? "simulation.trigger" : "simulation.complete")}
                </button>
              )}
            </div>
          </div>
        );
      })}

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
