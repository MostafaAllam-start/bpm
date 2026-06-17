// Logic tab: per-field conditional rules. Pick a field, then define when it is
// shown (Visible if) and when it becomes required (Required if). Rules are
// stored on the field as `visibleIf` / `requiredIf` expressions that the
// renderer already evaluates.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveText } from "../text";
import { buildExpression, parseExpression } from "../conditions";
import type { FormModel } from "./useFormModel";
import ConditionBuilder from "./ConditionBuilder";

type LogicTabProps = {
  model: FormModel;
  locale: string;
};

export default function LogicTab({ model, locale }: LogicTabProps) {
  const { t } = useTranslation("form");
  // Inputs only — display blocks (html) carry no value to condition on.
  const fields = model.fields.filter((f) => f.type !== "html");
  const [selected, setSelected] = useState<string | null>(
    fields[0]?.name ?? null,
  );

  const field = fields.find((f) => f.name === selected) ?? null;
  // A field can be triggered by any other (non-display) field.
  const triggers = fields.filter((f) => f.name !== selected);

  if (fields.length === 0) {
    return <div className="dz-tab-placeholder">{t("designer.logic.empty")}</div>;
  }

  const labelOf = (name: string) => {
    const f = fields.find((x) => x.name === name);
    return f ? resolveText(f.title, locale) || f.name : name;
  };

  return (
    <div className="dz-logic">
      <ul className="dz-logic-list">
        {fields.map((f) => {
          const hasRule = Boolean(f.visibleIf || f.requiredIf);
          return (
            <li key={f.name}>
              <button
                type="button"
                className={`dz-logic-item${f.name === selected ? " is-active" : ""}`}
                onClick={() => setSelected(f.name)}
              >
                <span>{resolveText(f.title, locale) || f.name}</span>
                {hasRule && <span className="dz-logic-dot" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="dz-logic-detail">
        {field && (
          <>
            <h4 className="dz-logic-heading">{labelOf(field.name)}</h4>

            <section className="dz-logic-section">
              <label className="dz-logic-section-title">
                {t("designer.logic.visibleIf")}
              </label>
              <p className="dz-prop-hint">{t("designer.logic.visibleHint")}</p>
              {triggers.length === 0 ? (
                <p className="dz-prop-hint">{t("designer.logic.needOther")}</p>
              ) : (
                <ConditionBuilder
                  group={parseExpression(field.visibleIf)}
                  fields={triggers}
                  locale={locale}
                  onChange={(group) =>
                    model.updateField(field.name, {
                      visibleIf: buildExpression(group) || undefined,
                    })
                  }
                />
              )}
            </section>

            <section className="dz-logic-section">
              <label className="dz-logic-section-title">
                {t("designer.logic.requiredIf")}
              </label>
              <p className="dz-prop-hint">{t("designer.logic.requiredHint")}</p>
              {triggers.length === 0 ? (
                <p className="dz-prop-hint">{t("designer.logic.needOther")}</p>
              ) : (
                <ConditionBuilder
                  group={parseExpression(field.requiredIf)}
                  fields={triggers}
                  locale={locale}
                  onChange={(group) =>
                    model.updateField(field.name, {
                      requiredIf: buildExpression(group) || undefined,
                    })
                  }
                />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
