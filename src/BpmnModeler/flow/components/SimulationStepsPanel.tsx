import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnEdge, BpmnNode, GlobalVariable } from "../types/index.ts";
import type { SimStep } from "../hooks/useTokenSimulation.ts";
import type { SavedActorForm } from "../../types.ts";
import { availableVariablesAt } from "../utils/variables.ts";
import type { AvailableVariable } from "../utils/variables.ts";

// The simulation steps menu: an ordered list of the elements the token has
// visited, with a pause / resume (and single-step) controller. Rendered in the
// right sidebar in place of the properties panel while a run is active. The
// currently-active element(s) are highlighted, and the list auto-scrolls to the
// latest step.
//
// Each step is clickable: selecting one expands an inline details card showing
// that element's id, type, actor assignment, business properties, the variables
// in scope there (grouped into the process globals and each upstream form, with
// the values captured so far this run) and its outgoing branches (with the
// condition expressions that route the token).

type SimulationStepsPanelProps = {
  trace: SimStep[];
  activeNodeIds: Set<string>;
  // The diagram graph + saved forms, used to resolve a clicked step's details.
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  savedActorForms: Record<string, SavedActorForm>;
  // The process-global variables, used to group a step's in-scope variables.
  globals: GlobalVariable[];
  // Live run variable store, so each in-scope variable shows its captured value.
  variables: Record<string, unknown>;
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

// Node props that aren't business metadata — label/title styling and the title
// position. Hidden from the details card.
const INTERNAL_PROPS = new Set([
  "labelColor", "labelFontSize", "labelFontFamily", "labelBold", "labelItalic",
  "lineStyle", "lineColor", "lineWidth",
  "titleColor", "titleFontSize", "titleFontFamily", "titleX", "titleY",
]);

// Render a run value (a form answer) as a short readable string.
function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export default function SimulationStepsPanel({
  trace,
  activeNodeIds,
  nodes,
  edges,
  savedActorForms,
  globals,
  variables,
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
  // The step whose details are expanded (by its unique trace key), or null.
  const [openKey, setOpenKey] = useState<string | null>(null);

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

  // Build the details card for a visited step from the live graph + run state.
  const renderDetails = (step: SimStep) => {
    const node = nodes.find((n) => n.id === step.nodeId);
    const props = node?.data.props ?? {};

    const actorName =
      props.actorName || props.actorEmployeeName || props.actorPrimaryName || props.actorValue || "";
    const actorKind = props.actorKind || "";
    const actorRole = props.actorRole || "";

    const businessProps = Object.entries(props).filter(
      ([k, v]) => v && !INTERNAL_PROPS.has(k) && !k.startsWith("actor"),
    );

    // Variables in scope at this step: the process globals plus everything the
    // upstream forms produce. Grouped into the process globals and one group per
    // source form, each showing the value captured so far this run.
    const available = availableVariablesAt({
      nodes,
      edges,
      savedActorForms,
      globals,
      nodeId: step.nodeId,
    });
    const globalVars = available.filter((v) => v.origin === "global");
    const formGroups = new Map<string, AvailableVariable[]>();
    for (const v of available) {
      if (v.origin !== "task") continue;
      const key = v.source || t("props.varCategory.form");
      const list = formGroups.get(key);
      if (list) list.push(v);
      else formGroups.set(key, [v]);
    }

    const renderVarList = (vars: AvailableVariable[]) => (
      <ul className="bf-sim-detail-list">
        {vars.map((v) => (
          <li key={v.name} className="bf-sim-detail-field">
            <span className="bf-sim-detail-field-key" title={v.type}>{v.name}</span>
            <span className="bf-sim-detail-field-val">{formatValue(variables[v.name])}</span>
          </li>
        ))}
      </ul>
    );

    const outs = edges.filter((e) => e.source === step.nodeId);
    const targetLabel = (id: string) => {
      const target = nodes.find((n) => n.id === id);
      return target ? target.data.name || t(ELEMENT_SPECS[target.data.bpmnType].labelKey) : id;
    };

    return (
      <div className="bf-sim-step-details">
        <div className="bf-sim-detail-row">
          <span className="bf-sim-detail-label">{t("props.id")}</span>
          <span className="bf-sim-detail-value">{step.nodeId}</span>
        </div>
        <div className="bf-sim-detail-row">
          <span className="bf-sim-detail-label">{t("simulation.detailType")}</span>
          <span className="bf-sim-detail-value">{t(ELEMENT_SPECS[step.bpmnType].labelKey)}</span>
        </div>
        {activeNodeIds.has(step.nodeId) && (
          <div className="bf-sim-detail-row">
            <span className="bf-sim-detail-label">{t("simulation.detailStatus")}</span>
            <span className="bf-sim-detail-value bf-sim-detail-active">{t("simulation.detailActive")}</span>
          </div>
        )}
        {actorName && (
          <div className="bf-sim-detail-row">
            <span className="bf-sim-detail-label">{t("simulation.detailActor")}</span>
            <span className="bf-sim-detail-value">
              {actorName}
              {actorKind ? ` (${t(`kind.${actorKind}`, { defaultValue: actorKind })}${actorRole ? ` · ${actorRole}` : ""})` : ""}
            </span>
          </div>
        )}

        {businessProps.length > 0 && (
          <div className="bf-sim-detail-group">
            <div className="bf-sim-detail-section">{t("simulation.detailProperties")}</div>
            <ul className="bf-sim-detail-list">
              {businessProps.map(([k, v]) => (
                <li key={k} className="bf-sim-detail-field">
                  <span className="bf-sim-detail-field-key">{k}</span>
                  <span className="bf-sim-detail-field-val">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(globalVars.length > 0 || formGroups.size > 0) && (
          <div className="bf-sim-detail-group">
            <div className="bf-sim-detail-section">{t("simulation.variablesTitle")}</div>
            <div className="bf-sim-detail-vargroups">
              {globalVars.length > 0 && (
                <div className="bf-sim-detail-vargroup">
                  <div className="bf-sim-detail-vargroup-title">{t("props.varCategory.process")}</div>
                  {renderVarList(globalVars)}
                </div>
              )}
              {[...formGroups.entries()].map(([source, vars]) => (
                <div key={source} className="bf-sim-detail-vargroup">
                  <div className="bf-sim-detail-vargroup-title">{source}</div>
                  {renderVarList(vars)}
                </div>
              ))}
            </div>
          </div>
        )}

        {outs.length > 0 && (
          <div className="bf-sim-detail-group">
            <div className="bf-sim-detail-section">{t("simulation.detailBranches")}</div>
            <ul className="bf-sim-detail-list">
              {outs.map((e) => (
                <li key={e.id} className="bf-sim-detail-branch">
                  <span className="bf-sim-detail-branch-target">
                    → {targetLabel(e.target)}
                    {e.data?.isDefault ? ` · ${t("simulation.detailDefault")}` : ""}
                  </span>
                  {e.data?.conditionExpression && (
                    <code className="bf-sim-detail-branch-cond">{e.data.conditionExpression}</code>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

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
          const key = `${step.nodeId}-${step.order}`;
          const open = openKey === key;
          return (
            <li
              key={key}
              className={`bf-sim-step${current ? " is-current" : ""}${open ? " is-open" : ""}`}
            >
              <button
                type="button"
                className="bf-sim-step-row"
                aria-expanded={open}
                onClick={() => setOpenKey((cur) => (cur === key ? null : key))}
              >
                <span className="bf-sim-step-index">{index + 1}</span>
                <span className="bf-sim-step-name" title={label}>{label}</span>
                <span className="bf-sim-step-type">
                  {t(ELEMENT_SPECS[step.bpmnType].labelKey)}
                </span>
                <span className="bf-sim-step-chevron" aria-hidden>{open ? "▾" : "▸"}</span>
              </button>
              {open && renderDetails(step)}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
