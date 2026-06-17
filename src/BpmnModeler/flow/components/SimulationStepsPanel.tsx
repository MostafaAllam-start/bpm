import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { SimStep } from "../hooks/useTokenSimulation.ts";

// The simulation steps menu: an ordered list of the elements the token has
// visited, with a pause / resume (and single-step) controller. Rendered in the
// right sidebar in place of the properties panel while a run is active. The
// currently-active element(s) are highlighted, and the list auto-scrolls to the
// latest step.

type SimulationStepsPanelProps = {
  trace: SimStep[];
  activeNodeIds: Set<string>;
  // Whether the sweep is still advancing. False once the token has reached the
  // end — the session stays open (this menu visible) until the user stops it.
  running: boolean;
  paused: boolean;
  // True while the sweep is blocked on a user interaction (a gateway choice or a
  // task/event the token is waiting on) — single-stepping can't progress then.
  waiting: boolean;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onRestart: () => void;
  onStop: () => void;
};

const ctrlIcon = {
  width: 13,
  height: 13,
  viewBox: "0 0 16 16",
  "aria-hidden": true,
};
const PauseIcon = () => (
  <svg {...ctrlIcon}><rect x="4" y="3" width="3" height="10" fill="currentColor" /><rect x="9" y="3" width="3" height="10" fill="currentColor" /></svg>
);
const ResumeIcon = () => (
  <svg {...ctrlIcon}><path d="M4 3l9 5-9 5z" fill="currentColor" /></svg>
);
const StepIcon = () => (
  <svg {...ctrlIcon}><path d="M4 3l7 5-7 5z" fill="currentColor" /><rect x="11" y="3" width="2.5" height="10" fill="currentColor" /></svg>
);
const StopIcon = () => (
  <svg {...ctrlIcon}><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" /></svg>
);
const RestartIcon = () => (
  <svg {...ctrlIcon} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" />
  </svg>
);

export default function SimulationStepsPanel({
  trace,
  activeNodeIds,
  running,
  paused,
  waiting,
  onPause,
  onResume,
  onStep,
  onRestart,
  onStop,
}: SimulationStepsPanelProps) {
  const { t } = useTranslation("bpmn");
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the latest step in view as the trace grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [trace.length]);

  const ended = !running;
  const status = ended
    ? t("simulation.statusEnded")
    : paused
      ? t("simulation.statusPaused")
      : waiting
        ? t("simulation.statusWaiting")
        : t("simulation.statusRunning");
  const statusClass = ended
    ? "is-ended"
    : paused
      ? "is-paused"
      : waiting
        ? "is-waiting"
        : "is-running";

  return (
    <aside className="bf-sim-sidebar">
      <div className="bf-sim-steps-head">
        <span className="bf-sim-steps-title">{t("simulation.stepsTitle")}</span>
        <span className={`bf-sim-steps-status ${statusClass}`}>{status}</span>
      </div>

      <div className="bf-sim-steps-controls">
        {ended ? (
          <button type="button" className="bf-sim-ctrl bf-sim-ctrl-primary" onClick={onRestart}>
            <RestartIcon />
            {t("simulation.restart")}
          </button>
        ) : paused ? (
          <button type="button" className="bf-sim-ctrl bf-sim-ctrl-primary" onClick={onResume}>
            <ResumeIcon />
            {t("simulation.resume")}
          </button>
        ) : (
          <button type="button" className="bf-sim-ctrl bf-sim-ctrl-primary" onClick={onPause}>
            <PauseIcon />
            {t("simulation.pause")}
          </button>
        )}
        {!ended && (
          <button
            type="button"
            className="bf-sim-ctrl"
            onClick={onStep}
            disabled={!paused || waiting}
            title={t("simulation.step")}
          >
            <StepIcon />
            {t("simulation.step")}
          </button>
        )}
        <button type="button" className="bf-sim-ctrl" onClick={onStop} title={t("simulation.stop")}>
          <StopIcon />
          {t("simulation.stop")}
        </button>
      </div>

      <ol className="bf-sim-steps-list" ref={listRef}>
        {trace.map((step, index) => {
          const label = step.name || t(ELEMENT_SPECS[step.bpmnType].labelKey);
          const current = activeNodeIds.has(step.nodeId);
          return (
            <li
              key={`${step.nodeId}-${step.order}`}
              className={`bf-sim-step${current ? " is-current" : ""}`}
            >
              <span className="bf-sim-step-index">{index + 1}</span>
              <span className="bf-sim-step-name" title={label}>{label}</span>
              <span className="bf-sim-step-type">
                {t(ELEMENT_SPECS[step.bpmnType].labelKey)}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
