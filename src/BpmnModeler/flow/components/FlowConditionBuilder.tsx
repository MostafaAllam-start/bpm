import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  buildExpression,
  parseExpression,
  type Condition,
  type ConditionGroup,
  type ConditionOp,
} from "@FormBuilder";
import {
  groupAvailableVariables,
  type AvailableVariable,
  type AvailableVariableGroup,
} from "../utils/variables.ts";

// Structured editor for a sequence-flow (gateway branch) condition. It edits the
// same `{var} op value` expression string the simulation evaluates, via the
// shared parse/build grammar — so a built condition routes the token at runtime.
//
// Two modes share the one underlying expression string:
//   • "builder"    — rows of {variable, operator, value} joined by all/any, with
//                    the variable picker grouped by category (process / form).
//   • "expression" — the raw string, for advanced edits the builder can't model.
// Switching to the builder re-seeds its rows from the current string, so the two
// stay consistent without live cross-syncing.

const OPS: ConditionOp[] = ["=", "!=", ">", "<", ">=", "<=", "contains"];

type FlowConditionBuilderProps = {
  value: string;
  variables: AvailableVariable[];
  onChange: (expression: string) => void;
};

export default function FlowConditionBuilder({
  value,
  variables,
  onChange,
}: FlowConditionBuilderProps) {
  const { t } = useTranslation("bpmn");
  // The builder's working rows. Seeded from the expression; kept locally so an
  // in-progress row with no value yet doesn't vanish on rebuild.
  const [group, setGroup] = useState<ConditionGroup>(() => parseExpression(value));
  // Default to the builder, but if an existing expression can't be modelled as
  // builder rows (free-form text), open in Expression mode so it isn't hidden.
  const [mode, setMode] = useState<"builder" | "expression">(() =>
    value.trim() && parseExpression(value).conditions.length === 0
      ? "expression"
      : "builder",
  );

  const groups = groupAvailableVariables(variables);
  // Keyed by ref (field id for form vars, name for globals) — the token a built
  // condition emits and looks type up by.
  const byRef = new Map(variables.map((v) => [v.ref, v]));

  const commit = (next: ConditionGroup) => {
    setGroup(next);
    onChange(buildExpression(next));
  };

  const setConnector = (connector: "and" | "or") =>
    commit({ ...group, connector });

  const setRow = (index: number, patch: Partial<Condition>) =>
    commit({
      ...group,
      conditions: group.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });

  const removeRow = (index: number) =>
    commit({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });

  const addRow = () =>
    commit({
      ...group,
      conditions: [
        ...group.conditions,
        { field: variables[0]?.ref ?? "", op: "=", value: "" },
      ],
    });

  // Entering the builder re-reads the current string so manual edits show up.
  const toBuilder = () => {
    setGroup(parseExpression(value));
    setMode("builder");
  };

  return (
    <div className="bf-cond">
      <div className="bf-cond-modes">
        <button
          type="button"
          className={`bf-cond-mode${mode === "builder" ? " is-active" : ""}`}
          onClick={toBuilder}
        >
          {t("props.conditionModeBuilder")}
        </button>
        <button
          type="button"
          className={`bf-cond-mode${mode === "expression" ? " is-active" : ""}`}
          onClick={() => setMode("expression")}
        >
          {t("props.conditionModeExpression")}
        </button>
      </div>

      {mode === "expression" ? (
        <input
          className="bf-cond-raw"
          value={value}
          placeholder="{amount} >= 1000"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : variables.length === 0 ? (
        <p className="bf-var-hint">{t("props.conditionNoVariables")}</p>
      ) : (
        <div className="bf-cond-rows">
          {group.conditions.length > 1 && (
            <div className="bf-cond-connector">
              <label>
                <input
                  type="radio"
                  checked={group.connector === "and"}
                  onChange={() => setConnector("and")}
                />
                {t("props.conditionMatchAll")}
              </label>
              <label>
                <input
                  type="radio"
                  checked={group.connector === "or"}
                  onChange={() => setConnector("or")}
                />
                {t("props.conditionMatchAny")}
              </label>
            </div>
          )}

          {group.conditions.map((cond, index) => {
            // Keep an out-of-scope field selectable so it isn't silently lost.
            const orphan = cond.field && !byRef.has(cond.field);
            return (
              <div key={index} className="bf-cond-row">
                <select
                  className="bf-cond-field"
                  value={cond.field}
                  aria-label={t("props.conditionVariable")}
                  onChange={(e) => setRow(index, { field: e.target.value })}
                >
                  <option value="" disabled>
                    {t("props.conditionVariable")}
                  </option>
                  {orphan && <option value={cond.field}>{cond.field}</option>}
                  {groups.map((g) => (
                    <optgroup
                      key={g.key}
                      label={t(`props.varCategory.${g.key}`)}
                    >
                      {g.variables.map((v) => (
                        <option key={v.ref} value={v.ref}>
                          {v.source ? `${v.name} — ${v.source}` : v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  className="bf-cond-op"
                  value={cond.op}
                  aria-label={t("props.conditionOperator")}
                  onChange={(e) =>
                    setRow(index, { op: e.target.value as ConditionOp })
                  }
                >
                  {OPS.map((op) => (
                    <option key={op} value={op}>
                      {op === "contains" ? t("props.conditionContains") : op}
                    </option>
                  ))}
                </select>

                <ValueEditor
                  type={byRef.get(cond.field)?.type}
                  value={cond.value}
                  groups={groups}
                  onChange={(v) => setRow(index, { value: v })}
                />

                <button
                  type="button"
                  className="bf-cond-remove"
                  aria-label={t("props.conditionRemove")}
                  title={t("props.conditionRemove")}
                  onClick={() => removeRow(index)}
                >
                  ×
                </button>
              </div>
            );
          })}

          <button type="button" className="bf-var-add" onClick={addRow}>
            + {t("props.conditionAdd")}
          </button>
        </div>
      )}
    </div>
  );
}

// Value editor for the right-hand operand. It compares the field against either
// a literal (a typed value, adapted to the field's coarse type: boolean →
// true/false dropdown, number → number field, date → date field, else text) or
// another in-scope variable (a `{name}` reference, e.g. `requestedDays <=
// maxLeaveDays`). The kind toggle switches between the two; the variable picker
// is grouped exactly like the field picker.
function ValueEditor({
  type,
  value,
  groups,
  onChange,
}: {
  type: string | undefined;
  value: string;
  groups: AvailableVariableGroup[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("bpmn");
  const ref = /^\{([^}]+)\}$/.exec(value.trim());
  const refName = ref?.[1]?.trim() ?? "";
  const isRef = Boolean(ref);
  const firstVar = groups[0]?.variables[0]?.ref ?? "";
  // A referenced variable that's no longer in scope: keep it selectable so the
  // condition isn't silently rewritten.
  const orphanRef =
    isRef && !groups.some((g) => g.variables.some((v) => v.ref === refName));

  const setKind = (kind: "literal" | "variable") =>
    onChange(kind === "variable" && firstVar ? `{${firstVar}}` : "");

  return (
    <div className="bf-cond-value-cell">
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

      {isRef ? (
        <select
          className="bf-cond-value"
          value={refName}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(`{${e.target.value}}`)}
        >
          {orphanRef && <option value={refName}>{refName}</option>}
          {groups.map((g) => (
            <optgroup key={g.key} label={t(`props.varCategory.${g.key}`)}>
              {g.variables.map((v) => (
                <option key={v.ref} value={v.ref}>
                  {v.source ? `${v.name} — ${v.source}` : v.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : type === "boolean" ? (
        <select
          className="bf-cond-value"
          value={value}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          className="bf-cond-value"
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={value}
          placeholder={t("props.conditionValue")}
          aria-label={t("props.conditionValue")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
