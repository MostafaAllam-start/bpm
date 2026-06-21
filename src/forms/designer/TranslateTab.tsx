// Translate tab: edit every localizable string of the form across the app's
// languages. Each cell reads/writes a locale on a `LocalizedText` value via the
// text helpers; the default (English) column doubles as the base text.

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import type { Choice, FormField, LocalizedText } from "../types";
import { getFieldType } from "../fieldTypes";
import { getLocaleText, resolveText, setLocaleText } from "../text";
import type { FormModel } from "./useFormModel";

type TranslateTabProps = {
  model: FormModel;
  locale: string;
};

type Entry = {
  id: string;
  label: string;
  value: LocalizedText | undefined;
  apply: (next: LocalizedText) => void;
};

export default function TranslateTab({ model, locale }: TranslateTabProps) {
  const { t } = useTranslation("form");
  const locales = SUPPORTED_LANGUAGES;

  // Form-level strings.
  const formEntries: Entry[] = [
    {
      id: "form.title",
      label: t("designer.props.formTitle"),
      value: model.schema.title,
      apply: (next) => model.updateForm({ title: next }),
    },
    {
      id: "form.description",
      label: t("designer.props.formDescription"),
      value: model.schema.description,
      apply: (next) => model.updateForm({ description: next }),
    },
  ];

  const fieldGroups = model.fields.map((field) => ({
    field,
    entries: entriesForField(field, model, t),
  }));

  const hasAnything =
    formEntries.some((e) => e.value) || model.fields.length > 0;

  if (!hasAnything) {
    return <div className="dz-tab-placeholder">{t("designer.translate.empty")}</div>;
  }

  return (
    <div className="dz-translate">
      <table className="dz-translate-table">
        <thead>
          <tr>
            <th>{t("designer.translate.string")}</th>
            {locales.map((lng) => (
              <th key={lng}>{t(`designer.translate.locales.${lng}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="dz-translate-group">
            <td colSpan={locales.length + 1}>{t("designer.formSettings")}</td>
          </tr>
          {formEntries.map((entry) => (
            <TranslateRow key={entry.id} entry={entry} locales={locales} />
          ))}

          {fieldGroups.map(({ field, entries }) =>
            entries.length === 0 ? null : (
              <FieldGroup
                key={field.name}
                field={field}
                entries={entries}
                locales={locales}
                locale={locale}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FieldGroup({
  field,
  entries,
  locales,
  locale,
}: {
  field: FormField;
  entries: Entry[];
  locales: readonly string[];
  locale: string;
}) {
  const def = getFieldType(field.type);
  const title = resolveText(field.title, locale) || field.name;
  return (
    <>
      <tr className="dz-translate-group">
        <td colSpan={locales.length + 1}>
          {title}
          <span className="dz-translate-type">{def?.type ?? field.type}</span>
        </td>
      </tr>
      {entries.map((entry) => (
        <TranslateRow key={entry.id} entry={entry} locales={locales} />
      ))}
    </>
  );
}

function TranslateRow({
  entry,
  locales,
}: {
  entry: Entry;
  locales: readonly string[];
}) {
  return (
    <tr>
      <td className="dz-translate-label">{entry.label}</td>
      {locales.map((lng) => (
        <td key={lng}>
          <input
            className="dz-prop-input"
            type="text"
            value={getLocaleText(entry.value, lng)}
            onChange={(e) =>
              entry.apply(setLocaleText(entry.value, lng, e.target.value))
            }
          />
        </td>
      ))}
    </tr>
  );
}

// Build the localizable entries for one field (title, description, placeholder,
// html, and each choice text), wired to the model's update helpers.
function entriesForField(
  field: FormField,
  model: FormModel,
  t: (key: string) => string,
): Entry[] {
  const def = getFieldType(field.type);
  const props = def?.editableProps ?? [];
  const entries: Entry[] = [];

  if (props.includes("title")) {
    entries.push({
      id: `${field.name}.title`,
      label: t("designer.props.title"),
      value: field.title,
      apply: (next) => model.updateField(field.name, { title: next }),
    });
  }
  if (props.includes("description")) {
    entries.push({
      id: `${field.name}.description`,
      label: t("designer.props.description"),
      value: field.description,
      apply: (next) => model.updateField(field.name, { description: next }),
    });
  }
  if (props.includes("placeholder")) {
    entries.push({
      id: `${field.name}.placeholder`,
      label: t("designer.props.placeholder"),
      value: field.placeholder,
      apply: (next) => model.updateField(field.name, { placeholder: next }),
    });
  }
  if (props.includes("html")) {
    entries.push({
      id: `${field.name}.html`,
      label: t("designer.props.html"),
      value: field.html,
      apply: (next) => model.updateField(field.name, { html: next }),
    });
  }
  if (props.includes("dynamicText")) {
    entries.push({
      id: `${field.name}.text`,
      label: t("designer.props.dynamicText"),
      value: field.text,
      apply: (next) => model.updateField(field.name, { text: next }),
    });
  }
  if (props.includes("choices") && field.choices) {
    field.choices.forEach((choice, index) => {
      entries.push({
        id: `${field.name}.choice.${choice.value}`,
        label: `${t("designer.props.choices")} · ${choice.value}`,
        value: choice.text,
        apply: (next) =>
          model.updateField(field.name, {
            choices: replaceChoiceText(field.choices ?? [], index, next),
          }),
      });
    });
  }
  if (props.includes("table")) {
    (field.tableColumns ?? []).forEach((col, index) => {
      entries.push({
        id: `${field.name}.col.${index}`,
        label: `${t("designer.table.columns")} · ${index + 1}`,
        value: col,
        apply: (next) =>
          model.updateField(field.name, {
            tableColumns: replaceAt(field.tableColumns ?? [], index, next),
          }),
      });
    });
    // Body rows, plus an API table's manual top / bottom rows. Each is a
    // `LocalizedText[][]` on its own field key; cells translate independently.
    const rowSets: { key: "tableRows" | "tableTopRows" | "tableBottomRows"; label: string }[] = [
      { key: "tableRows", label: t("designer.table.rows") },
      { key: "tableTopRows", label: t("designer.table.topRows") },
      { key: "tableBottomRows", label: t("designer.table.bottomRows") },
    ];
    for (const { key, label } of rowSets) {
      (field[key] ?? []).forEach((row, r) => {
        row.forEach((cell, c) => {
          entries.push({
            id: `${field.name}.${key}.${r}.${c}`,
            label: `${label} · ${r + 1}×${c + 1}`,
            value: cell,
            apply: (next) =>
              model.updateField(field.name, {
                [key]: (field[key] ?? []).map((rr, ri) =>
                  ri === r ? replaceAt(rr, c, next) : rr,
                ),
              }),
          });
        });
      });
    }
  }

  return entries;
}

function replaceAt(
  list: LocalizedText[],
  index: number,
  value: LocalizedText,
): LocalizedText[] {
  return list.map((item, i) => (i === index ? value : item));
}

function replaceChoiceText(
  choices: Choice[],
  index: number,
  text: LocalizedText,
): Choice[] {
  return choices.map((c, i) => (i === index ? { ...c, text } : c));
}
