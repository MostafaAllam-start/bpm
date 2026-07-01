import type { FieldRenderProps } from "../../utils/fieldTypes";
import { resolveText } from "../../utils/text";
import { useChoiceOptions } from "./useChoiceOptions";
import { Feedback } from "./Feedback";

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
