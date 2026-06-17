import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  buildExpression,
  parseExpression,
  type Condition,
  type ConditionGroup,
  type ConditionOp,
} from "../../../forms/conditions.ts";
import {
  groupAvailableVariables,
  type AvailableVariable,
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
  const byName = new Map(variables.map((v) => [v.name, v]));

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
        { field: variables[0]?.name ?? "", op: "=", value: "" },
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
            const orphan = cond.field && !byName.has(cond.field);
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
                        <option key={v.name} value={v.name}>
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
                  type={byName.get(cond.field)?.type}
                  value={cond.value}
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

// Value input adapted to the chosen variable's coarse type: boolean → a
// true/false dropdown, number → a number field, date → a date field, else text.
function ValueEditor({
  type,
  value,
  onChange,
}: {
  type: string | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("bpmn");
  if (type === "boolean") {
    return (
      <select
        className="bf-cond-value"
        value={value}
        aria-label={t("props.conditionValue")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  return (
    <input
      className="bf-cond-value"
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      value={value}
      placeholder={t("props.conditionValue")}
      aria-label={t("props.conditionValue")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
