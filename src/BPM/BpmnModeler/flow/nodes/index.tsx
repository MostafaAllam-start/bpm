import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import type { BpmnNodeData } from "../types/index.ts";
import { ELEMENT_SPECS } from "../types/index.ts";
import { TaskIcon, GatewaySymbol, EventIcon } from "../components/icons/index.ts";
import ContextPad from "./ContextPad.tsx";
import { labelStyleFrom } from "../utils/labelStyle.ts";
import { localizedValue } from "../utils/localizedText.ts";
import { useValidationStore } from "../store/validationStore.ts";
import ActorAvatar from "../../components/ActorAvatar.tsx";
import { useActorStore } from "../../store/actorStore.ts";
import type { SavedActor } from "../../store/actorStore.ts";
import type { ActorAvatarKind } from "../../types.ts";

// React Flow custom nodes for the three BPMN visual categories. Each is
// registered in `nodeTypes` under its category key (`node.type`), reads the
// specific BPMN type from `data.bpmnType`, and renders the matching shape with
// connection handles on all four sides (the canvas uses ConnectionMode.Loose so
// any handle can be a source or a target).

// Connection affordances, shown on hover/select (styled in CSS):
//  - four edge strips so a flow can be dragged from any border (Camunda-style),
//  - a prominent "connect" arrow nub at the right edge to drag a new flow from.
// ConnectionMode.Loose lets any of these act as a source or a target.
function NodeHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="connect" className="bf-connect-handle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h12M13 6l6 6-6 6" />
        </svg>
      </Handle>
    </>
  );
}

// The human-readable actor label assigned to a task, if any.
function actorLabel(data: BpmnNodeData): string | null {
  const p = data.props;
  return p.actorName || p.actorEmployeeName || p.actorPrimaryName || p.actorValue || null;
}

// The `bpmn`-namespace translation key for the assigned actor's type (Manager,
// Employee, Org unit, Org type, Group, …), shown beneath the actor's name.
// Mirrors the kinds offered in the actor selector; returns null when no actor
// is assigned. Reuses the selector's own `kind.*` / `roleOption.*` keys.
function actorTypeKey(p: Record<string, string>): string | null {
  switch (p.actorKind) {
    case "orgtype":
      return "kind.orgtype";
    case "orgunit":
      return "kind.orgunit";
    case "group":
      return "kind.group";
    case "employee":
      return "kind.employee";
    // A "role" actor is either a manager or a plain employee.
    case "role":
      return p.actorRole === "manager" ? "roleOption.manager" : "roleOption.employee";
    case "custom":
      return "kind.custom";
    default:
      return null;
  }
}

// Which avatar glyph a task's assigned actor uses, derived from the persisted
// `actorKind` (so it works for imported diagrams too). Returns null for actors
// with no visual entity ("custom") or unassigned tasks, which keep the BPMN
// task-type icon.
function avatarKindFromProps(p: Record<string, string>): ActorAvatarKind | null {
  switch (p.actorKind) {
    case "group":
      return "group";
    case "orgtype":
      return "org";
    // An org-unit assignment narrowed to one employee shows that person.
    case "orgunit":
      return p.actorEmployeeId ? "person" : "org";
    case "employee":
    case "role":
      return "person";
    default:
      return null;
  }
}

// The actor's image from the saved selection (kept in the actor store, not the
// BPMN props, so the volatile signed URL stays out of the exported XML). Absent
// for imported diagrams — the avatar then falls back to its kind glyph.
function avatarImageFromSaved(saved: SavedActor | undefined): string | null {
  if (!saved) return null;
  switch (saved.kind) {
    case "group":
      return saved.group?.image ?? null;
    case "orgtype":
      return saved.orgType?.image ?? null;
    case "orgunit":
      return saved.employee?.image ?? saved.orgUnit?.image ?? null;
    case "employee":
      return saved.employee?.image ?? null;
    case "role":
      return (saved.role === "manager" ? saved.manager : saved.employee)?.image ?? null;
    default:
      return null;
  }
}

// The validation badge shown on a node that has issues. Subscribes to just this
// node's slice of the validation store so only affected nodes re-render.
function ValidationBadge({ nodeId }: { nodeId: string }) {
  const issues = useValidationStore((s) => s.byNode[nodeId]);
  if (!issues?.length) return null;
  const error = issues.some((i) => i.severity === "error");
  return (
    <span
      className={`bf-validation-badge ${error ? "is-error" : "is-warn"}`}
      title={issues.map((i) => i.messageKey).join("\n")}
    >
      !
    </span>
  );
}

function EventNodeImpl({ id, data }: NodeProps) {
  const d = data as BpmnNodeData;
  const { i18n } = useTranslation("bpmn");
  const style = { background: d.fill, borderColor: d.stroke };
  const name = localizedValue(d.name, d.props.nameAr, i18n.language);
  return (
    <div className={`bf-event bf-event-${d.bpmnType}`} style={style}>
      <ContextPad nodeId={id} />
      <ValidationBadge nodeId={id} />
      <NodeHandles />
      <span className="bf-event-icon">
        <EventIcon type={d.bpmnType} />
      </span>
      {name && (
        <div className="bf-label bf-label-below" style={labelStyleFrom(d.props)}>
          {name}
        </div>
      )}
    </div>
  );
}

function TaskNodeImpl({ id, data }: NodeProps) {
  const d = data as BpmnNodeData;
  const { t, i18n } = useTranslation("bpmn");
  const style = { background: d.fill, borderColor: d.stroke };
  const actor = actorLabel(d);
  const actorType = actorTypeKey(d.props);
  const name = localizedValue(d.name, d.props.nameAr, i18n.language);
  const title = name || t(ELEMENT_SPECS[d.bpmnType].labelKey);
  // When an actor is assigned, the corner glyph becomes the actor's logo /
  // photo (with a kind-appropriate fallback) instead of the BPMN task icon.
  const avatarKind = avatarKindFromProps(d.props);
  // Ignore a stale store entry (the store is keyed by node id across diagrams)
  // whose kind no longer matches what's persisted on this node.
  const savedActor = useActorStore((s) =>
    s.actors[id]?.kind === d.props.actorKind ? s.actors[id] : undefined,
  );
  return (
    <div className="bf-task" style={style}>
      <ContextPad nodeId={id} />
      <ValidationBadge nodeId={id} />
      <NodeHandles />
      <div className="bf-task-head">
        <span className="bf-task-icon">
          {avatarKind ? (
            <ActorAvatar
              image={avatarImageFromSaved(savedActor)}
              kind={avatarKind}
              className="bf-task-actor-avatar"
            />
          ) : (
            <TaskIcon type={d.bpmnType} />
          )}
        </span>
        {actor && <div className="bf-task-actor">{actor}</div>}
        {actorType && <div className="bf-task-actor-type">{t(actorType)}</div>}
      </div>
      <div
        className={`bf-task-label${name ? "" : " bf-task-label-muted"}`}
        style={labelStyleFrom(d.props)}
      >
        {title}
      </div>
    </div>
  );
}

function GatewayNodeImpl({ id, data }: NodeProps) {
  const d = data as BpmnNodeData;
  const { i18n } = useTranslation("bpmn");
  const style = { background: d.fill, borderColor: d.stroke };
  const name = localizedValue(d.name, d.props.nameAr, i18n.language);
  return (
    <div className="bf-gateway-wrap">
      <ContextPad nodeId={id} />
      <ValidationBadge nodeId={id} />
      <NodeHandles />
      <div className="bf-gateway" style={style} />
      <span className="bf-gateway-symbol">
        <GatewaySymbol type={d.bpmnType} />
      </span>
      {name && (
        <div className="bf-label bf-label-below" style={labelStyleFrom(d.props)}>
          {name}
        </div>
      )}
    </div>
  );
}

export const EventNode = memo(EventNodeImpl);
export const TaskNode = memo(TaskNodeImpl);
export const GatewayNode = memo(GatewayNodeImpl);
