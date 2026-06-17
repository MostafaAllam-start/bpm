// Renderers for choice fields (dropdown / radio group / checkboxes). They read
// their options via `useChoiceOptions`, so they work the same whether the
// options are entered manually or fetched from an API, with loading/error
// feedback.

import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../fieldTypes";
import { resolveText } from "../text";
import { useChoiceOptions } from "./useChoiceOptions";

function Feedback({ loading, error }: { loading: boolean; error: string | null }) {
  const { t } = useTranslation("form");
  if (loading) return <p className="ff-hint">{t("designer.choicesApi.loading")}</p>;
  if (error) return <p className="ff-error">{t("designer.choicesApi.error", { error })}</p>;
  return null;
}

export function DropdownField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const { options, loading, error } = useChoiceOptions(p.field);
  // A placeholder prompt (disabled + hidden) instead of a blank, selectable
  // option: it shows when nothing is chosen but isn't an option in the list.
  const placeholder =
    resolveText(p.field.placeholder, p.locale) || t("designer.selectPlaceholder");
  return (
    <>
      <select
        id={p.id}
        className="ff-input ff-select"
        disabled={p.disabled || loading}
        value={(p.value as string) ?? ""}
        onChange={(e) => p.onChange(e.target.value)}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map((c) => (
          <option key={c.value} value={c.value}>
            {resolveText(c.text, p.locale)}
          </option>
        ))}
      </select>
      <Feedback loading={loading} error={error} />
    </>
  );
}

export function RadioField(p: FieldRenderProps) {
  const { options, loading, error } = useChoiceOptions(p.field);
  return (
    <>
      <div className="ff-choices" role="radiogroup">
        {options.map((c) => (
          <label key={c.value} className="ff-choice">
            <input
              type="radio"
              name={p.id}
              disabled={p.disabled}
              checked={p.value === c.value}
              onChange={() => p.onChange(c.value)}
            />
            <span>{resolveText(c.text, p.locale)}</span>
          </label>
        ))}
      </div>
      <Feedback loading={loading} error={error} />
    </>
  );
}

export function CheckboxField(p: FieldRenderProps) {
  const { options, loading, error } = useChoiceOptions(p.field);
  const selected = Array.isArray(p.value) ? (p.value as string[]) : [];
  const toggle = (val: string) =>
    p.onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val],
    );
  const capped = typeof p.field.optionsMaxHeight === "number";
  return (
    <>
      <div
        className={`ff-choices${capped ? " ff-choices-scroll" : ""}`}
        style={capped ? { maxHeight: p.field.optionsMaxHeight } : undefined}
      >
        {options.map((c) => (
          <label key={c.value} className="ff-choice">
            <input
              type="checkbox"
              disabled={p.disabled}
              checked={selected.includes(c.value)}
              onChange={() => toggle(c.value)}
            />
            <span>{resolveText(c.text, p.locale)}</span>
          </label>
        ))}
      </div>
      <Feedback loading={loading} error={error} />
    </>
  );
}
