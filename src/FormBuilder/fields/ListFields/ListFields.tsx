// Ordered and unordered list display fields. Supports manual items (with locale
// resolution) or items fetched from a remote API. In the runtime/preview,
// unresolved {variable} tokens in the title render as @-chip badges instead of
// the raw brace syntax.

import { type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FieldRenderProps } from "../../utils/fieldTypes";
import type { VariableRef } from "@shared/variables.ts";
import { resolveText } from "../../utils/text";
import { useListItems } from "./useListItems";

// Render a template string into ReactNodes. Tokens resolved from `scope` are
// inserted as text; unresolved tokens show as `@name` chip badges so the
// author can see which bindings are missing in the preview.
export function renderWithRuntimeChips(
  template: string,
  scope: Record<string, unknown>,
): ReactNode[] {
  const TOKEN = /\{([A-Za-z0-9_.-]+)\}/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(template)) !== null) {
    if (match.index > lastIndex) parts.push(template.slice(lastIndex, match.index));
    const ref = match[1];
    const hasVal =
      Object.prototype.hasOwnProperty.call(scope, ref) && scope[ref] != null;
    if (hasVal) {
      const v = scope[ref];
      parts.push(Array.isArray(v) ? (v as unknown[]).join(", ") : String(v));
    } else {
      parts.push(<span key={k++} className="ff-var-chip">{ref}</span>);
    }
    lastIndex = TOKEN.lastIndex;
  }
  if (lastIndex < template.length) parts.push(template.slice(lastIndex));
  return parts;
}

// Designer-canvas chip rendering: tokens matched against known VariableRefs get
// a `dz-mention-chip` badge showing `TaskName.fieldKey`; unrecognised tokens
// stay as literal text (broken / out-of-scope reference).
function renderWithVariableChips(
  template: string,
  variables: VariableRef[],
): ReactNode[] {
  const TOKEN = /\{([A-Za-z0-9_.-]+)\}/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(template)) !== null) {
    if (match.index > lastIndex) parts.push(template.slice(lastIndex, match.index));
    const tokenRef = match[1];
    const variable = variables.find((v) => (v.ref ?? v.name) === tokenRef);
    if (variable) {
      const label = variable.source
        ? `${variable.source}.${variable.name}`
        : variable.name;
      parts.push(
        <span key={match.index} className="dz-mention-chip">
          {label}
        </span>,
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = TOKEN.lastIndex;
  }
  if (lastIndex < template.length) parts.push(template.slice(lastIndex));
  return parts;
}

// Pick the right rendering for a title text: runtime chips, designer chips, or
// plain text.
function renderTitle(
  text: string,
  scope: Record<string, unknown> | undefined,
  variables: VariableRef[] | undefined,
): ReactNode {
  if (!text) return null;
  if (scope !== undefined) {
    const nodes = renderWithRuntimeChips(text, scope);
    return <>{nodes}</>;
  }
  if (variables?.length) {
    const chips = renderWithVariableChips(text, variables);
    return <>{chips}</>;
  }
  return text;
}

// Render a single list item's text, applying runtime chips when in preview mode.
function renderItemText(
  text: string,
  scope: Record<string, unknown> | undefined,
): ReactNode {
  if (scope !== undefined) return <>{renderWithRuntimeChips(text, scope)}</>;
  return text;
}

export function OrderedListField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const { items, loading, error } = useListItems(p.field, p.locale);

  const titleText = p.field.listTitle ? resolveText(p.field.listTitle, p.locale) : "";
  const titleContent = renderTitle(titleText, p.scope, p.variables);

  const titleStyle: CSSProperties = {
    ...(p.field.listTitleColor && { color: p.field.listTitleColor }),
    ...(p.field.listTitleFontWeight && { fontWeight: p.field.listTitleFontWeight }),
    ...(p.field.listTitleFontSize && { fontSize: `${p.field.listTitleFontSize}px` }),
    ...(p.field.listTitleFontFamily && { fontFamily: p.field.listTitleFontFamily }),
  };
  const listStyle = {
    ...(p.field.listMaxHeight && {
      maxHeight: `${p.field.listMaxHeight}px`,
      overflowY: "auto" as const,
    }),
    ...(p.field.listTextColor && { color: p.field.listTextColor }),
    ...(p.field.listFontWeight && { fontWeight: p.field.listFontWeight }),
    ...(p.field.listFontSize && { fontSize: `${p.field.listFontSize}px` }),
    ...(p.field.listFontFamily && { fontFamily: p.field.listFontFamily }),
    ...(p.field.listStyleColor && {
      "--ff-list-marker-color": p.field.listStyleColor,
    }),
  } as CSSProperties;

  if (!loading && !error && !items.length && !titleContent) {
    return <div className="ff-list-empty">{p.field.type}</div>;
  }

  return (
    <div className="ff-list-wrapper">
      {titleContent && (
        <div className="ff-list-title" style={titleStyle}>
          {titleContent}
        </div>
      )}
      {loading && <p className="ff-hint">{t("designer.listItemsApi.loading")}</p>}
      {error && (
        <p className="ff-error">{t("designer.listItemsApi.error", { error })}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ol className="ff-list ff-list-ordered" style={listStyle}>
          {items.map((text, i) => (
            <li key={i}>{renderItemText(text, p.scope)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function UnorderedListField(p: FieldRenderProps) {
  const { t } = useTranslation("form");
  const { items, loading, error } = useListItems(p.field, p.locale);

  const titleText = p.field.listTitle ? resolveText(p.field.listTitle, p.locale) : "";
  const titleContent = renderTitle(titleText, p.scope, p.variables);

  const titleStyle: CSSProperties = {
    ...(p.field.listTitleColor && { color: p.field.listTitleColor }),
    ...(p.field.listTitleFontWeight && { fontWeight: p.field.listTitleFontWeight }),
    ...(p.field.listTitleFontSize && { fontSize: `${p.field.listTitleFontSize}px` }),
    ...(p.field.listTitleFontFamily && { fontFamily: p.field.listTitleFontFamily }),
  };
  const listStyle = {
    listStyleType: p.field.listStyle || "disc",
    ...(p.field.listMaxHeight && {
      maxHeight: `${p.field.listMaxHeight}px`,
      overflowY: "auto" as const,
    }),
    ...(p.field.listTextColor && { color: p.field.listTextColor }),
    ...(p.field.listFontWeight && { fontWeight: p.field.listFontWeight }),
    ...(p.field.listFontSize && { fontSize: `${p.field.listFontSize}px` }),
    ...(p.field.listFontFamily && { fontFamily: p.field.listFontFamily }),
    ...(p.field.listStyleColor && {
      "--ff-list-marker-color": p.field.listStyleColor,
    }),
  } as CSSProperties;

  if (!loading && !error && !items.length && !titleContent) {
    return <div className="ff-list-empty">{p.field.type}</div>;
  }

  return (
    <div className="ff-list-wrapper">
      {titleContent && (
        <div className="ff-list-title" style={titleStyle}>
          {titleContent}
        </div>
      )}
      {loading && <p className="ff-hint">{t("designer.listItemsApi.loading")}</p>}
      {error && (
        <p className="ff-error">{t("designer.listItemsApi.error", { error })}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="ff-list ff-list-unordered" style={listStyle}>
          {items.map((text, i) => (
            <li key={i}>{renderItemText(text, p.scope)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
