// A small condition-group editor used by the Logic tab. Edits a
// `ConditionGroup` (a list of `{field op value}` rows joined by and/or) against
// the available trigger fields. Value editors adapt to the trigger field's type
// (choice → dropdown, boolean → true/false, else free text).

import { useTranslation } from "react-i18next";
import type { FormField } from "../types";
import { resolveText } from "../text";
import {
  type Condition,
  type ConditionGroup,
  type ConditionOp,
} from "../conditions";

const OPS: ConditionOp[] = ["=", "!=", ">", "<", ">=", "<=", "contains"];

type ConditionBuilderProps = {
  group: ConditionGroup;
  fields: FormField[];
  locale: string;
  onChange: (group: ConditionGroup) => void;
};

export default function ConditionBuilder({
  group,
  fields,
  locale,
  onChange,
}: ConditionBuilderProps) {
  const { t } = useTranslation("form");

  const setConnector = (connector: "and" | "or") =>
    onChange({ ...group, connector });

  const setRow = (index: number, patch: Partial<Condition>) =>
    onChange({
      ...group,
      conditions: group.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });

  const removeRow = (index: number) =>
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });

  const addRow = () =>
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        { field: fields[0]?.name ?? "", op: "=", value: "" },
      ],
    });

  const labelOf = (field: FormField) =>
    resolveText(field.title, locale) || field.name;

  return (
    <div className="dz-cond">
      {group.conditions.length > 1 && (
        <div className="dz-cond-connector">
          <label>
            <input
              type="radio"
              checked={group.connector === "and"}
              onChange={() => setConnector("and")}
            />
            {t("designer.logic.all")}
          </label>
          <label>
            <input
              type="radio"
              checked={group.connector === "or"}
              onChange={() => setConnector("or")}
            />
            {t("designer.logic.any")}
          </label>
        </div>
      )}

      {group.conditions.map((cond, index) => {
        const trigger = fields.find((f) => f.name === cond.field);
        return (
          <div key={index} className="dz-cond-row">
            <select
              className="dz-prop-input"
              value={cond.field}
              onChange={(e) => setRow(index, { field: e.target.value })}
            >
              {fields.map((f) => (
                <option key={f.name} value={f.name}>
                  {labelOf(f)}
                </option>
              ))}
            </select>

            <select
              className="dz-prop-input dz-cond-op"
              value={cond.op}
              onChange={(e) => setRow(index, { op: e.target.value as ConditionOp })}
            >
              {OPS.map((op) => (
                <option key={op} value={op}>
                  {op === "contains" ? t("designer.logic.contains") : op}
                </option>
              ))}
            </select>

            <ValueEditor
              trigger={trigger}
              locale={locale}
              value={cond.value}
              onChange={(value) => setRow(index, { value })}
            />

            <button
              type="button"
              className="dz-choice-remove"
              aria-label={t("designer.logic.removeRule")}
              onClick={() => removeRow(index)}
            >
              ✕
            </button>
          </div>
        );
      })}

      <button type="button" className="dz-choice-add" onClick={addRow}>
        + {t("designer.logic.addRule")}
      </button>
    </div>
  );
}

function ValueEditor({
  trigger,
  locale,
  value,
  onChange,
}: {
  trigger: FormField | undefined;
  locale: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (trigger?.type === "boolean") {
    return (
      <select
        className="dz-prop-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (trigger?.choices && trigger.choices.length > 0) {
    return (
      <select
        className="dz-prop-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" />
        {trigger.choices.map((c) => (
          <option key={c.value} value={c.value}>
            {resolveText(c.text, locale)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="dz-prop-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
