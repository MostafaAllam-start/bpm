import { useState, useReducer, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { parseGroupedExpression, resolveText, type Choice, type ConditionOp } from "@FormBuilder";
import { type AvailableVariable } from "../utils/variables.ts";
import { UndoIcon, RedoIcon, PlusIcon, DragHandleIcon } from "./icons/index.ts";
import BpmnModal from "./BpmnModal/index.ts";


// ── Recursive tree types ──────────────────────────────────────────────────────
// `sep` = the connector placed *before* this item in its parent list.
// The first item in any list has sep stored but it is never rendered.
type ModalCond = { kind: "cond"; sep: "and" | "or"; field: string; op: ConditionOp; value: string };
type ModalGroup = { kind: "group"; sep: "and" | "or"; items: ModalItem[] };
type ModalItem = ModalCond | ModalGroup;
type ModalState = { items: ModalItem[] };

// ── Undo / redo history ───────────────────────────────────────────────────────

type HistoryState = { past: ModalState[]; present: ModalState; future: ModalState[] };
type HistAction =
  | { type: "set"; fn: (s: ModalState) => ModalState }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(s: HistoryState, a: HistAction): HistoryState {
  if (a.type === "set") {
    return { past: [...s.past, s.present], present: a.fn(s.present), future: [] };
  }
  if (a.type === "undo") {
    if (!s.past.length) return s;
    return { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] };
  }
  if (!s.future.length) return s;
  return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) };
}

// ── Drag types ────────────────────────────────────────────────────────────────
type DragFrom = { path: number[]; index: number };
type DropAt = { path: number[]; index: number };

// ── Tree helpers ──────────────────────────────────────────────────────────────

function updateAtPath(
  rootItems: ModalItem[],
  path: number[],
  updater: (items: ModalItem[]) => ModalItem[],
): ModalItem[] {
  if (path.length === 0) return updater(rootItems);
  const [head, ...tail] = path;
  return rootItems.map((item, i) =>
    i === head && item.kind === "group"
      ? { ...item, items: updateAtPath(item.items, tail, updater) }
      : item,
  );
}

// Toggle the `sep` of the item at `index` inside the list at `path`.
function toggleSepAt(state: ModalState, path: number[], index: number): ModalState {
  return {
    ...state,
    items: updateAtPath(state.items, path, (items) =>
      items.map((item, i) =>
        i === index ? { ...item, sep: item.sep === "and" ? "or" : "and" } : item,
      ),
    ),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function condValueError(
  type: string | undefined,
  value: string,
  isRef: boolean,
  hasChoices?: boolean,
  fieldRequired?: boolean,
): "required" | "not-number" | null {
  if (isRef) return null;
  if (value === "") {
    if (hasChoices && !fieldRequired) return null;
    return "required";
  }
  if (type === "number" && isNaN(Number(value.trim()))) return "not-number";
  return null;
}

function treeHasErrors(
  items: ModalItem[],
  byRef: Map<string, AvailableVariable>,
): boolean {
  return items.some((item) => {
    if (item.kind === "group") {
      if (item.items.length < 2) return true;
      return treeHasErrors(item.items, byRef);
    }
    const isValueRef = /^\{[^}]+\}$/.test(item.value.trim());
    const fv = byRef.get(item.field);
    return condValueError(fv?.type, item.value, isValueRef, !!fv?.choices?.length, fv?.required) !== null;
  });
}

function serializeList(items: ModalItem[], wrap: boolean): string {
  const parts: Array<{ text: string; sep: "and" | "or" }> = [];
  for (const item of items) {
    const text = serializeItem(item);
    if (text) parts.push({ text, sep: item.sep });
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].text;
  let out = parts[0].text;
  for (let i = 1; i < parts.length; i++) out += ` ${parts[i].sep} ${parts[i].text}`;
  return wrap ? `(${out})` : out;
}

function serializeItem(item: ModalItem): string {
  if (item.kind === "cond") return item.field ? `{${item.field}} ${item.op} ${item.value}` : "";
  return serializeList(item.items, true);
}

function serializeRoot(state: ModalState): string {
  return serializeList(state.items, false);
}

function emptyCondition(field: string): ModalCond {
  return { kind: "cond", sep: "and", field, op: "=", value: "" };
}

function initState(expression: string, firstRef: string): ModalState {
  const gc = parseGroupedExpression(expression);
  if (gc.groups.length === 1 && gc.groups[0].conditions.length === 0) {
    return { items: [emptyCondition(firstRef)] };
  }
  if (!expression.trim().startsWith("(") && gc.groups.length === 1) {
    const g = gc.groups[0];
    return {
      items: g.conditions.map((c, ci) => ({
        kind: "cond" as const,
        sep: (ci === 0 ? "and" : g.connector) as "and" | "or",
        field: c.field,
        op: c.op,
        value: c.value,
      })),
    };
  }
  return {
    items: gc.groups.map((g, gi) => ({
      kind: "group" as const,
      sep: (gi === 0 ? "and" : gc.groupConnector) as "and" | "or",
      items: g.conditions.map((c, ci) => ({
        kind: "cond" as const,
        sep: (ci === 0 ? "and" : g.connector) as "and" | "or",
        field: c.field,
        op: c.op,
        value: c.value,
      })),
    })),
  };
}

// ── Drag helpers ──────────────────────────────────────────────────────────────

// Returns true when toPath goes through the subtree rooted at from.
function isDescendantPath(from: DragFrom, toPath: number[]): boolean {
  const ancestor = [...from.path, from.index];
  if (toPath.length < ancestor.length) return false;
  return ancestor.every((seg, i) => toPath[i] === seg);
}

// Remove item at `from`, insert it at `to` (indices relative to post-remove tree).
function moveItemInTree(
  rootItems: ModalItem[],
  from: DragFrom,
  to: DropAt,
): ModalItem[] {
  const items = JSON.parse(JSON.stringify(rootItems)) as ModalItem[];

  function getList(path: number[]): ModalItem[] {
    let list = items;
    for (const seg of path) {
      const node = list[seg];
      if (!node || node.kind !== "group") break;
      list = node.items;
    }
    return list;
  }

  const sourceList = getList(from.path);
  const [moved] = sourceList.splice(from.index, 1);

  // After removing the source, adjust to.path/to.index if they share the same
  // parent list level as the source (indices shift by -1 after the removal).
  let toPath = to.path;
  let toIndex = to.index;

  if (toPath.length > from.path.length) {
    const isPrefix = from.path.every((seg, i) => toPath[i] === seg);
    if (isPrefix && toPath[from.path.length] > from.index) {
      toPath = [...toPath];
      toPath[from.path.length]--;
    }
  } else if (
    JSON.stringify(toPath) === JSON.stringify(from.path) &&
    toIndex > from.index
  ) {
    toIndex--;
  }

  getList(toPath).splice(toIndex, 0, moved);
  return items;
}

// ── Variable grouping helpers ─────────────────────────────────────────────────

type VarDropGroup = { key: string; variables: AvailableVariable[] };

function groupByTask(variables: AvailableVariable[]): VarDropGroup[] {
  const globals = variables.filter((v) => v.origin === "global");
  const bySource = new Map<string, AvailableVariable[]>();
  for (const v of variables) {
    if (v.origin !== "task") continue;
    const key = v.source ?? "Task";
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(v);
  }
  const groups: VarDropGroup[] = [];
  if (globals.length) groups.push({ key: "process", variables: globals });
  bySource.forEach((vars, key) => groups.push({ key, variables: vars }));
  return groups;
}

function varDisplayLabel(v: AvailableVariable): string {
  return v.origin === "task" && v.source ? `@${v.source}.${v.name}` : v.name;
}

// ── Component ─────────────────────────────────────────────────────────────────

type ConditionModalProps = {
  title: string;
  value: string;
  variables: AvailableVariable[];
  onApply: (expression: string) => void;
  onClose: () => void;
};

export default function ConditionModal({
  title,
  value,
  variables,
  onApply,
  onClose,
}: ConditionModalProps) {
  const { t } = useTranslation("bpmn");

  const byRef = new Map(variables.map((v) => [v.ref, v]));
  const firstRef = variables[0]?.ref ?? "";

  const [hs, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [] as ModalState[],
    present: initState(value, firstRef),
    future: [] as ModalState[],
  }));
  const ms = hs.present;
  const canUndo = hs.past.length > 0;
  const canRedo = hs.future.length > 0;
  const hasAnyError = treeHasErrors(ms.items, byRef);

  const setMs = (fn: (s: ModalState) => ModalState) => dispatch({ type: "set", fn });
  const undo = () => dispatch({ type: "undo" });
  const redo = () => dispatch({ type: "redo" });

  // Keyboard shortcuts — skip when focus is inside an input/select so the
  // browser's own undo (for typed text) isn't captured.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = e.target as Element;
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "undo" }); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); dispatch({ type: "redo" }); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [dragFrom, setDragFrom] = useState<DragFrom | null>(null);
  const [dropTarget, setDropTarget] = useState<DropAt | null>(null);

  // Delay the state update so the browser captures the drag image before React
  // re-renders with the dimmed appearance.
  const onDragStart = (path: number[], index: number) => (e: DragEvent) => {
    (e as unknown as { dataTransfer: DataTransfer }).dataTransfer.effectAllowed = "move";
    setTimeout(() => setDragFrom({ path, index }), 0);
  };

  const onDragEnd = () => {
    setDragFrom(null);
    setDropTarget(null);
  };

  const onDropAt = (to: DropAt) => {
    if (!dragFrom) return;
    if (isDescendantPath(dragFrom, to.path)) return;

    const samePath = JSON.stringify(dragFrom.path) === JSON.stringify(to.path);
    if (samePath && (to.index === dragFrom.index || to.index === dragFrom.index + 1)) {
      setDragFrom(null);
      setDropTarget(null);
      return;
    }

    setMs((s) => ({
      ...s,
      items: moveItemInTree(s.items, dragFrom, to),
    }));
    setDragFrom(null);
    setDropTarget(null);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCond = (parentPath: number[]) =>
    setMs((s) => ({
      ...s,
      items: updateAtPath(s.items, parentPath, (items) => [
        ...items,
        emptyCondition(firstRef),
      ]),
    }));

  const addGroup = (parentPath: number[]) =>
    setMs((s) => ({
      ...s,
      items: updateAtPath(s.items, parentPath, (items) => [
        ...items,
        { kind: "group" as const, sep: "and" as const, items: [emptyCondition(firstRef)] },
      ]),
    }));

  const removeItem = (parentPath: number[], index: number) =>
    setMs((s) => ({
      ...s,
      items: updateAtPath(s.items, parentPath, (items) =>
        items.filter((_, i) => i !== index),
      ),
    }));

  // Removing a group with conditions flattens its children into the parent.
  // The first flattened child inherits the group's own sep so the relative
  // position in the parent list is preserved.
  const removeGroup = (parentPath: number[], index: number) =>
    setMs((s) => ({
      ...s,
      items: updateAtPath(s.items, parentPath, (items) => {
        const target = items[index];
        if (target.kind === "group" && target.items.length > 0) {
          const children = target.items.map((child, ci) =>
            ci === 0 ? { ...child, sep: target.sep } : child,
          );
          return [...items.slice(0, index), ...children, ...items.slice(index + 1)];
        }
        return items.filter((_, i) => i !== index);
      }),
    }));

  const updateCond = (
    parentPath: number[],
    index: number,
    patch: Partial<Omit<ModalCond, "kind">>,
  ) =>
    setMs((s) => ({
      ...s,
      items: updateAtPath(s.items, parentPath, (items) =>
        items.map((item, i) =>
          i === index && item.kind === "cond" ? { ...item, ...patch } : item,
        ),
      ),
    }));

  const toggleSep = (path: number[], index: number) =>
    setMs((s) => toggleSepAt(s, path, index));

  // ── Drop slot factory ──────────────────────────────────────────────────────

  const slot = (path: number[], index: number) => (
    <DropSlot
      path={path}
      index={index}
      dragFrom={dragFrom}
      dropTarget={dropTarget}
      setDropTarget={setDropTarget}
      onDrop={onDropAt}
    />
  );

  // ── Recursive rendering ────────────────────────────────────────────────────
  // Function declarations so renderItemList ↔ renderGroup can mutually recurse.

  function renderItemList(parentPath: number[], items: ModalItem[]) {
    return (
      <div className={`bf-cond-rows${items.length === 0 && dragFrom ? " is-empty-drop" : ""}`}>
        {slot(parentPath, 0)}
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="bf-cond-group-sep bf-cond-group-sep--inner">
                <button
                  type="button"
                  className={`bf-cond-conn-btn${item.sep === "and" ? " is-active" : ""}`}
                  title={t("props.conditionToggleConnector")}
                  onClick={() => toggleSep(parentPath, i)}
                >
                  AND
                </button>
                <button
                  type="button"
                  className={`bf-cond-conn-btn${item.sep === "or" ? " is-active" : ""}`}
                  title={t("props.conditionToggleConnector")}
                  onClick={() => toggleSep(parentPath, i)}
                >
                  OR
                </button>
              </div>
            )}
            {item.kind === "cond"
              ? renderCond(parentPath, i, item, items.length)
              : renderGroup(parentPath, i, item, items.length)}
            {slot(parentPath, i + 1)}
          </Fragment>
        ))}
      </div>
    );
  }

  function renderCond(
    parentPath: number[],
    index: number,
    cond: ModalCond,
    siblingCount: number,
  ) {
    const isDragged =
      dragFrom !== null &&
      JSON.stringify(dragFrom.path) === JSON.stringify(parentPath) &&
      dragFrom.index === index;

    const fieldVar = byRef.get(cond.field);
    const isRef = /^\{[^}]+\}$/.test(cond.value.trim());
    const errKind = condValueError(fieldVar?.type, cond.value, isRef, !!fieldVar?.choices?.length, fieldVar?.required);
    const errMsg =
      errKind === "required"
        ? t("props.conditionErrorRequired")
        : errKind === "not-number"
          ? t("props.conditionErrorNotNumber")
          : null;

    const availableOps: ConditionOp[] = fieldVar?.choices?.length
      ? ["=", "!="]
      : fieldVar?.type === "string"
        ? ["=", "!=", "contains"]
        : ["=", "!=", ">", "<", ">=", "<="];

    return (
      <>
        <div className={`bf-cond-row${isDragged ? " is-dragging" : ""}`}>
          <DragHandle
            onDragStart={onDragStart(parentPath, index)}
            onDragEnd={onDragEnd}
          />
          <VariableSelect
            value={cond.field}
            variables={variables}
            orphan={cond.field && !byRef.has(cond.field) ? cond.field : undefined}
            onChange={(field) => {
              const newVar = byRef.get(field);
              const newOps: ConditionOp[] = newVar?.choices?.length
                ? ["=", "!="]
                : newVar?.type === "string"
                  ? ["=", "!=", "contains"]
                  : ["=", "!=", ">", "<", ">=", "<="];
              const opPatch = !newOps.includes(cond.op) ? { op: "=" as ConditionOp } : {};
              updateCond(parentPath, index, { field, ...opPatch });
            }}
          />
          <select
            className="bf-cond-op"
            value={cond.op}
            aria-label={t("props.conditionOperator")}
            onChange={(e) =>
              updateCond(parentPath, index, { op: e.target.value as ConditionOp })
            }
          >
            {availableOps.map((op) => (
              <option key={op} value={op}>
                {op === "contains" ? t("props.conditionContains") : op}
              </option>
            ))}
          </select>
          <ValueEditor
            type={fieldVar?.type}
            value={cond.value}
            variables={variables}
            choices={fieldVar?.choices}
            fieldRequired={fieldVar?.required}
            onChange={(v) => updateCond(parentPath, index, { value: v })}
            hasError={errMsg !== null}
          />
          <button
            type="button"
            className="bf-cond-remove"
            aria-label={t("props.conditionRemove")}
            title={t("props.conditionRemove")}
            disabled={siblingCount <= 1}
            onClick={() => removeItem(parentPath, index)}
          >
            ×
          </button>
        </div>
        {errMsg && <p className="bf-cond-row-error">{errMsg}</p>}
      </>
    );
  }

  function renderGroup(
    parentPath: number[],
    itemIndex: number,
    group: ModalGroup,
    _siblingCount: number,
  ) {
    const groupPath = [...parentPath, itemIndex];
    const isNested = parentPath.length > 0;
    const isDragged =
      dragFrom !== null &&
      JSON.stringify(dragFrom.path) === JSON.stringify(parentPath) &&
      dragFrom.index === itemIndex;

    return (
      <div
        className={`bf-cond-group-box${isNested ? " bf-cond-group-nested" : ""}${isDragged ? " is-dragging" : ""}`}
      >
        <div className="bf-cond-group-head">
          <DragHandle
            onDragStart={onDragStart(parentPath, itemIndex)}
            onDragEnd={onDragEnd}
          />
          <span className="bf-cond-group-label">
            {t("props.conditionGroup")} {itemIndex + 1}
          </span>
          <button
            type="button"
            className="bf-cond-remove"
            aria-label={t("props.removeConditionGroup")}
            title={t("props.removeConditionGroup")}
            onClick={() => removeGroup(parentPath, itemIndex)}
          >
            ×
          </button>
        </div>

        {renderItemList(groupPath, group.items)}

        {group.items.length < 2 && (
          <p className="bf-cond-group-error">{t("props.conditionErrorGroupMin")}</p>
        )}

        <div className="bf-cond-group-footer">
          <button type="button" className="bf-var-add" onClick={() => addCond(groupPath)}>
            + {t("props.conditionAdd")}
          </button>
          <button type="button" className="bf-var-add" onClick={() => addGroup(groupPath)}>
            + {t("props.addConditionGroup")}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const toolbar = variables.length > 0 ? (
    <>
      <button type="button" className="bf-cond-toolbar-btn" onClick={() => addCond([])}>
        <PlusIcon />
        {t("props.conditionAdd")}
      </button>
      <button type="button" className="bf-cond-toolbar-btn" onClick={() => addGroup([])}>
        <PlusIcon />
        {t("props.addConditionGroup")}
      </button>
      <div className="bf-cond-toolbar-sep" />
      <button
        type="button"
        className="bf-cond-toolbar-icon-btn"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="bf-cond-toolbar-icon-btn"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
        disabled={!canRedo}
        onClick={redo}
      >
        <RedoIcon />
      </button>
    </>
  ) : undefined;

  return (
    <BpmnModal
      open
      title={title || t("props.conditionModalTitle")}
      subtitle={title ? t("props.conditionModalTitle") : undefined}
      onClose={onClose}
      onApply={() => onApply(serializeRoot(ms))}
      applyDisabled={hasAnyError}
      toolbar={toolbar}
    >
      {variables.length === 0 ? (
        <p className="bf-var-hint">{t("props.conditionNoVariables")}</p>
      ) : (
        <div className={`bf-cond-groups${dragFrom ? " drag-active" : ""}`}>
          {slot([], 0)}
          {ms.items.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <div className="bf-cond-group-sep">
                  <button
                    type="button"
                    className={`bf-cond-conn-btn${item.sep === "and" ? " is-active" : ""}`}
                    onClick={() => toggleSep([], i)}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    className={`bf-cond-conn-btn${item.sep === "or" ? " is-active" : ""}`}
                    onClick={() => toggleSep([], i)}
                  >
                    OR
                  </button>
                </div>
              )}
              {item.kind === "cond"
                ? renderCond([], i, item, ms.items.length)
                : renderGroup([], i, item, ms.items.length)}
              {slot([], i + 1)}
            </Fragment>
          ))}
        </div>
      )}
    </BpmnModal>
  );
}

// ── DragHandle ────────────────────────────────────────────────────────────────

function DragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className="bf-cond-drag-handle"
      draggable
      onDragStart={onDragStart as unknown as React.DragEventHandler}
      onDragEnd={onDragEnd}
      title="Drag to reorder"
    >
      <DragHandleIcon />
    </div>
  );
}

// ── DropSlot ──────────────────────────────────────────────────────────────────

function DropSlot({
  path,
  index,
  dragFrom,
  dropTarget,
  setDropTarget,
  onDrop,
}: {
  path: number[];
  index: number;
  dragFrom: DragFrom | null;
  dropTarget: DropAt | null;
  setDropTarget: (t: DropAt | null) => void;
  onDrop: (to: DropAt) => void;
}) {
  if (!dragFrom) return null;

  // A slot immediately before or after the dragged item in the same list is a no-op.
  const samePath = JSON.stringify(path) === JSON.stringify(dragFrom.path);
  if (samePath && (index === dragFrom.index || index === dragFrom.index + 1)) return null;

  // Slots inside the dragged item's own subtree are unreachable — hide them.
  if (isDescendantPath(dragFrom, path)) return null;

  const isActive =
    dropTarget !== null &&
    JSON.stringify(dropTarget.path) === JSON.stringify(path) &&
    dropTarget.index === index;

  return (
    <div
      className={`bf-cond-drop-slot${isActive ? " is-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget({ path, index });
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop({ path, index });
      }}
    />
  );
}

// ── VariableSelect ────────────────────────────────────────────────────────────

function VariableSelect({
  value,
  variables,
  orphan,
  onChange,
}: {
  value: string;
  variables: AvailableVariable[];
  orphan?: string;
  onChange: (ref: string) => void;
}) {
  const { t } = useTranslation("bpmn");
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selected = variables.find((v) => v.ref === value) ?? null;
  const groups = groupByTask(variables);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropStyle({ top: r.bottom + 4, left: r.left, minWidth: r.width });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="bf-var-select">
      <button
        ref={triggerRef}
        type="button"
        className="bf-var-select-trigger"
        aria-label={t("props.conditionVariable")}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleOpen}
      >
        {selected ? (
          <span className="bf-var-badge">{varDisplayLabel(selected)}</span>
        ) : orphan ? (
          <span className="bf-var-badge bf-var-badge--orphan">{orphan}</span>
        ) : (
          <span className="bf-var-select-ph">{t("props.conditionVariable")}</span>
        )}
        <svg
          className="bf-var-select-chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div ref={dropRef} className="bf-var-select-drop" style={dropStyle} role="listbox">
            {orphan && !selected && (
              <div className="bf-var-select-grp">
                <button
                  type="button"
                  className="bf-var-select-opt is-selected"
                  role="option"
                  aria-selected
                  onClick={() => { onChange(orphan); setOpen(false); }}
                >
                  <span className="bf-var-badge bf-var-badge--orphan">{orphan}</span>
                </button>
              </div>
            )}
            {groups.map((group, gi) => (
              <div key={gi} className="bf-var-select-grp">
                <div className="bf-var-select-grp-label">
                  {group.key === "process" ? t("props.varCategory.process") : group.key}
                </div>
                {group.variables.map((v) => (
                  <button
                    key={v.ref}
                    type="button"
                    className={`bf-var-select-opt${v.ref === value ? " is-selected" : ""}`}
                    role="option"
                    aria-selected={v.ref === value}
                    onClick={() => { onChange(v.ref); setOpen(false); }}
                  >
                    <span className="bf-var-badge">{v.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── ValueEditor ───────────────────────────────────────────────────────────────

function ValueEditor({
  type,
  value,
  variables,
  onChange,
  hasError,
  choices,
  fieldRequired,
}: {
  type: string | undefined;
  value: string;
  variables: AvailableVariable[];
  onChange: (value: string) => void;
  hasError?: boolean;
  choices?: Choice[];
  fieldRequired?: boolean;
}) {
  const { t, i18n } = useTranslation("bpmn");
  const ref = /^\{([^}]+)\}$/.exec(value.trim());
  const refName = ref?.[1]?.trim() ?? "";
  const isRef = Boolean(ref);
  const firstVar = variables[0]?.ref ?? "";
  const orphanRef = isRef && !variables.some((v) => v.ref === refName)
    ? refName
    : undefined;

  const setKind = (kind: "literal" | "variable") =>
    onChange(kind === "variable" && firstVar ? `{${firstVar}}` : "");

  const valueClass = `bf-cond-value${hasError ? " has-error" : ""}`;

  return (
    <div className="bf-cond-value-cell">
      {isRef ? (
        <VariableSelect
          value={refName}
          variables={variables}
          orphan={orphanRef}
          onChange={(r) => onChange(`{${r}}`)}
        />
      ) : choices?.length ? (
        <select
          className={valueClass}
          value={value}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(e.target.value)}
        >
          {!fieldRequired && (
            <option value="">{t("props.conditionNotSelected")}</option>
          )}
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {resolveText(c.text, i18n.language)}
            </option>
          ))}
        </select>
      ) : type === "boolean" ? (
        <select
          className={valueClass}
          value={value}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          className={valueClass}
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={value}
          placeholder={t("props.conditionValue")}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {firstVar && (
        <select
          className="bf-cond-value-kind"
          value={isRef ? "variable" : "literal"}
          aria-label={t("props.conditionValueKind")}
          onChange={(e) => setKind(e.target.value as "literal" | "variable")}
        >
          <option value="literal">{t("props.conditionValueLiteral")}</option>
          <option value="variable">{t("props.conditionValueVariable")}</option>
        </select>
      )}
    </div>
  );
}
