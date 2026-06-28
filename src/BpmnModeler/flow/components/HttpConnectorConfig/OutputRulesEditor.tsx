import { useTranslation } from "react-i18next";
import type { HttpOutputRule } from "../../types/index.ts";
import type { GlobalVariable } from "../../types/index.ts";

type OutputRulesEditorProps = {
  rules: HttpOutputRule[];
  processVariables: GlobalVariable[];
  onChange: (next: HttpOutputRule[]) => void;
};

function newRule(): HttpOutputRule {
  return { id: crypto.randomUUID(), targetVar: "", condition: "", value: "" };
}

export function OutputRulesEditor({
  rules,
  processVariables,
  onChange,
}: OutputRulesEditorProps) {
  const { t } = useTranslation("bpmn");

  const add = () => onChange([...rules, newRule()]);
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...rules];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };
  const moveDown = (idx: number) => {
    if (idx === rules.length - 1) return;
    const next = [...rules];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };
  const patch = (id: string, patch: Partial<HttpOutputRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="bf-http-rules">
      {rules.map((rule, idx) => (
        <div key={rule.id} className="bf-http-rule">
          <div className="bf-http-rule-controls">
            <button
              type="button"
              className="bf-http-move-btn"
              disabled={idx === 0}
              onClick={() => moveUp(idx)}
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              className="bf-http-move-btn"
              disabled={idx === rules.length - 1}
              onClick={() => moveDown(idx)}
              title="Move down"
            >
              ▼
            </button>
            <button
              type="button"
              className="bf-http-row-remove"
              onClick={() => remove(rule.id)}
              title="Remove rule"
            >
              ×
            </button>
          </div>
          <div className="bf-http-rule-fields">
            <div className="bf-http-rule-row">
              <span className="bf-http-rule-label">{t("props.httpRuleTarget")}</span>
              <select
                value={rule.targetVar}
                onChange={(e) => patch(rule.id, { targetVar: e.target.value })}
              >
                <option value="">{t("props.httpRuleTargetPlaceholder")}</option>
                {processVariables.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bf-http-rule-row">
              <span className="bf-http-rule-label">{t("props.httpRuleCondition")}</span>
              <input
                value={rule.condition}
                placeholder={t("props.httpRuleConditionPlaceholder")}
                onChange={(e) => patch(rule.id, { condition: e.target.value })}
              />
            </div>
            <div className="bf-http-rule-row">
              <span className="bf-http-rule-label">{t("props.httpRuleValue")}</span>
              <input
                value={rule.value}
                placeholder={t("props.httpRuleValuePlaceholder")}
                onChange={(e) => patch(rule.id, { value: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="bf-http-add-btn" onClick={add}>
        + {t("props.httpAddRule")}
      </button>
    </div>
  );
}
