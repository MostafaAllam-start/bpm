// A section box: a titled, bordered container positioned behind the fields
// placed within it (they render on top via their own z-index). When
// `collapsible`, the header toggles the section; its fields are then hidden
// and the box shrinks. Used by FormRenderer for "group" type fields.

import type { FormField } from "../types";
import { resolveText } from "../utils/text";
import { interpolate } from "../utils/interpolation";

export function GroupSection({
  field,
  locale,
  scope,
  collapsed,
  left,
  top,
  widthCss,
  height,
  zIndex,
  onToggle,
}: {
  field: FormField;
  locale: string;
  scope: Record<string, unknown>;
  collapsed: boolean;
  // The section's scaled left + width, and its (unscaled) top + height.
  left: number;
  top: number;
  widthCss: string;
  height: number;
  zIndex: number;
  onToggle: () => void;
}) {
  const title = interpolate(resolveText(field.title, locale), scope);
  const showHead = title.trim() !== "" || Boolean(field.collapsible);
  const HEAD_HEIGHT = 40;
  const head = (
    <>
      {field.collapsible && (
        <span className="ff-group-caret" aria-hidden="true">
          {collapsed ? "▸" : "▾"}
        </span>
      )}
      {title && <span className="ff-group-title">{title}</span>}
    </>
  );
  return (
    <div
      className="ff-field ff-field-display ff-group-field"
      style={{
        position: "absolute",
        left,
        top,
        width: widthCss,
        height: collapsed ? HEAD_HEIGHT : height,
        zIndex,
      }}
    >
      <div
        className={`ff-group${field.collapsible ? " is-collapsible" : ""}${
          collapsed ? " is-collapsed" : ""
        }`}
      >
        {showHead &&
          (field.collapsible ? (
            <button
              type="button"
              className="ff-group-head"
              onClick={onToggle}
              aria-expanded={!collapsed}
            >
              {head}
            </button>
          ) : (
            <div className="ff-group-head">{head}</div>
          ))}
      </div>
    </div>
  );
}
