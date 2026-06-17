// The runtime: renders a FormSchema as a fillable form. Owns answer state,
// evaluates conditional visibility, validates on submit, and applies the theme
// as CSS variables. Used by the designer's Preview tab now and by real
// end-user form filling later. No third-party form library.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { FormSchema, FormValues } from "./types";
import { getFieldType } from "./fieldTypes";
import { resolveText } from "./text";
import { evaluateExpression } from "./conditions";
import { isFieldRequired, validateForm, type ValidationErrors } from "./validation";
import { themeToCssVars } from "./theme";
import { colSpanToVars } from "./layout";

type FormRendererProps = {
  schema: FormSchema;
  locale: string;
  onSubmit?: (values: FormValues) => void;
};

export default function FormRenderer({
  schema,
  locale,
  onSubmit,
}: FormRendererProps) {
  const { t } = useTranslation("form");
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [completed, setCompleted] = useState(false);

  const fields = useMemo(
    () => schema.pages.flatMap((page) => page.elements),
    [schema],
  );
  const themeStyle = useMemo(() => themeToCssVars(schema.theme), [schema.theme]);

  const setValue = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = () => {
    const found = validateForm(fields, values);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setCompleted(true);
      onSubmit?.(values);
    }
  };

  if (completed) {
    return (
      <div className="ff-root ff-complete" style={themeStyle}>
        <div className="ff-complete-card">
          <h3>{t("designer.preview.completedTitle")}</h3>
          <button
            type="button"
            className="ff-btn ff-btn-ghost"
            onClick={() => {
              setCompleted(false);
              setValues({});
              setErrors({});
            }}
          >
            {t("designer.preview.again")}
          </button>
        </div>
      </div>
    );
  }

  const title = resolveText(schema.title, locale);
  const description = resolveText(schema.description, locale);

  return (
    <div className="ff-root" style={themeStyle}>
      {(title || description) && (
        <header className="ff-header">
          {title && <h2 className="ff-title">{title}</h2>}
          {description && <p className="ff-desc">{description}</p>}
        </header>
      )}

      <div className="ff-fields">
        {fields.map((field) => {
          if (
            field.visibleIf &&
            !evaluateExpression(field.visibleIf, values)
          ) {
            return null;
          }
          const def = getFieldType(field.type);
          if (!def) return null;

          const fieldId = `ff-${field.name}`;
          const label = resolveText(field.title, locale) || field.name;
          const fieldDesc = resolveText(field.description, locale);
          const required = isFieldRequired(field, values);
          const error = errors[field.name];

          // Display-only blocks (html) render without the label shell.
          if (def.group === "display") {
            return (
              <div
                key={field.name}
                className="ff-field ff-field-display"
                style={colSpanToVars(field.colSpan)}
              >
                {def.Render({
                  field,
                  value: values[field.name],
                  onChange: (v) => setValue(field.name, v),
                  locale,
                  id: fieldId,
                })}
              </div>
            );
          }

          return (
            <div
              key={field.name}
              className={`ff-field${error ? " has-error" : ""}`}
              style={colSpanToVars(field.colSpan)}
            >
              <label className="ff-label" htmlFor={fieldId}>
                {label}
                {required && <span className="ff-required" aria-hidden="true"> *</span>}
              </label>
              {fieldDesc && <p className="ff-field-desc">{fieldDesc}</p>}
              {def.Render({
                field,
                value: values[field.name],
                onChange: (v) => setValue(field.name, v),
                locale,
                id: fieldId,
              })}
              {error && (
                <p className="ff-error">{t(`designer.errors.${error}`)}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="ff-actions">
        <button type="button" className="ff-btn ff-btn-primary" onClick={handleSubmit}>
          {t("designer.preview.submit")}
        </button>
      </div>
    </div>
  );
}
