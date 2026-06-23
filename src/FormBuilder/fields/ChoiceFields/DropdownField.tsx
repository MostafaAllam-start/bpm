import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../../utils/fieldTypes";
import { resolveText } from "../../utils/text";
import { useChoiceOptions } from "./useChoiceOptions";
import { Feedback } from "./Feedback";

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
