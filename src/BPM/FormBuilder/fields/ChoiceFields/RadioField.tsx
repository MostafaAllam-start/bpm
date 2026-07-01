import type { FieldRenderProps } from "../../utils/fieldTypes";
import { resolveText } from "../../utils/text";
import { useChoiceOptions } from "./useChoiceOptions";
import { Feedback } from "./Feedback";

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
