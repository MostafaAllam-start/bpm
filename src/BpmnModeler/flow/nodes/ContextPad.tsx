import { useState } from "react";
import { NodeToolbar, Position, useStore } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { useFlowActions } from "../FlowActionsContext.ts";
import { COLOR_PRESETS } from "../utils/colors.ts";
import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnElementType, BpmnNodeData } from "../types/index.ts";
import { EventIcon, GatewaySymbol, TaskIcon } from "./nodeIcons.tsx";

// The bpmn.io-style context pad: a floating toolbar of actions that appears next
// to a node when it's selected. The "append" gestures (task / gateway / event)
// each open a small menu so the user picks the exact element subtype before it's
// created and connected; the palette button opens a colour-swatch menu; delete
// removes the node. Connecting is done by dragging (border strips / connect nub).

const icon = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// A small "+" plus the element's silhouette → "append a connected <shape>".
const Plus = () => <path d="M20 9v6M17 12h6" />;
const AppendTaskIcon = () => <svg {...icon}><rect x="2.5" y="7" width="11" height="9" rx="2.2" /><Plus /></svg>;
const AppendGatewayIcon = () => <svg {...icon}><path d="M8 6.5 12.7 11.5 8 16.5 3.3 11.5z" /><Plus /></svg>;
const AppendEventIcon = () => <svg {...icon}><circle cx="8" cy="11.5" r="5" /><Plus /></svg>;
const PaletteIcon = () => (
  <svg {...icon}>
    <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.4-.7 1.4-1.5 0-.4-.2-.8-.2-1.2 0-.7.5-1.3 1.3-1.3H16a4 4 0 0 0 4-4c0-5-3.6-9-8-9Z" />
    <circle cx="7.5" cy="11" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="16.2" cy="11" r="1.05" fill="currentColor" stroke="none" />
  </svg>
);
const TrashIcon = () => <svg {...icon}><path d="M4 7h16M10 7V4.5h4V7M6.5 7l.9 12.5h9.2L17.5 7" /></svg>;

// The subtypes offered under each "append" button (start events can't be
// appended, so the event menu only lists end / intermediate events).
const TASK_TYPES: BpmnElementType[] = [
  "userTask", "serviceTask", "manualTask", "scriptTask", "sendTask", "receiveTask", "businessRuleTask",
];
const GATEWAY_TYPES: BpmnElementType[] = [
  "exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway",
];
const EVENT_TYPES: BpmnElementType[] = [
  "endEvent", "intermediateThrowEvent", "intermediateCatchEvent",
];

// The mini glyph shown beside each subtype in an append menu, reusing the same
// icons the nodes and palette draw.
function TypeGlyph({ type }: { type: BpmnElementType }) {
  const category = ELEMENT_SPECS[type].category;
  if (category === "gateway") return <GatewaySymbol type={type} />;
  if (category === "event") return <EventIcon type={type} />;
  if (type === "task") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
        <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
      </svg>
    );
  }
  return <TaskIcon type={type} />;
}

type MenuKind = "task" | "gateway" | "event" | "color";

type ContextPadProps = { nodeId: string };

export default function ContextPad({ nodeId }: ContextPadProps) {
  const { t } = useTranslation("bpmn");
  const actions = useFlowActions();
  const [open, setOpen] = useState<MenuKind | null>(null);

  // You can't append a second end event to a node that already flows straight
  // into one (it would just duplicate the terminator).
  const endsHere = useStore((s) => {
    for (const e of s.edges) {
      if (e.source !== nodeId) continue;
      if ((s.nodeLookup.get(e.target)?.data as BpmnNodeData)?.bpmnType === "endEvent") return true;
    }
    return false;
  });

  // The process holds a single end event: once one exists anywhere, the
  // end-event append is disabled globally (addNode enforces the same rule, but
  // disabling avoids a dead click that would only raise a toast).
  const endExistsAnywhere = useStore((s) => {
    for (const [, n] of s.nodeLookup) {
      if ((n.data as BpmnNodeData)?.bpmnType === "endEvent") return true;
    }
    return false;
  });

  const toggle = (kind: MenuKind) => setOpen((cur) => (cur === kind ? null : kind));

  const appendType = (type: BpmnElementType) => {
    actions.append(nodeId, type);
    setOpen(null);
  };

  const MENU_TYPES: Record<Exclude<MenuKind, "color">, BpmnElementType[]> = {
    task: TASK_TYPES,
    gateway: GATEWAY_TYPES,
    event: EVENT_TYPES,
  };

  return (
    <NodeToolbar position={Position.Top} offset={10} align="center">
      <div className="bf-context-pad">
        <button type="button" title={t("pad.appendTask")} className={open === "task" ? "is-active" : undefined} onClick={() => toggle("task")}>
          <AppendTaskIcon />
        </button>
        <button type="button" title={t("pad.appendGateway")} className={open === "gateway" ? "is-active" : undefined} onClick={() => toggle("gateway")}>
          <AppendGatewayIcon />
        </button>
        <button type="button" title={t("pad.appendEvent")} className={open === "event" ? "is-active" : undefined} onClick={() => toggle("event")}>
          <AppendEventIcon />
        </button>
        <button type="button" title={t("pad.color")} className={open === "color" ? "is-active" : undefined} onClick={() => toggle("color")}>
          <PaletteIcon />
        </button>
        <button type="button" className="bf-pad-danger" title={t("pad.delete")} onClick={() => actions.remove(nodeId)}>
          <TrashIcon />
        </button>

        {open === "color" && (
          <div className="bf-pad-colors" role="menu">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.key}
                type="button"
                className="bf-pad-swatch"
                style={{ background: c.fill ?? "transparent", borderColor: c.stroke ?? "var(--border-strong)" }}
                title={t(`color.${c.key}`)}
                onClick={() => {
                  actions.setColor(nodeId, c.fill, c.stroke);
                  setOpen(null);
                }}
              >
                {!c.fill && <span className="bf-pad-swatch-none" aria-hidden>/</span>}
              </button>
            ))}
          </div>
        )}

        {open && open !== "color" && (
          <div className="bf-pad-menu" role="menu">
            {MENU_TYPES[open].map((type) => {
              const disabled = type === "endEvent" && (endsHere || endExistsAnywhere);
              const disabledTitle = endExistsAnywhere ? t("pad.endSingleton") : t("pad.endExists");
              return (
                <button
                  key={type}
                  type="button"
                  className="bf-pad-type"
                  disabled={disabled}
                  title={disabled ? disabledTitle : undefined}
                  onClick={() => appendType(type)}
                >
                  <span className="bf-pad-type-ico"><TypeGlyph type={type} /></span>
                  <span>{t(ELEMENT_SPECS[type].labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </NodeToolbar>
  );
}
