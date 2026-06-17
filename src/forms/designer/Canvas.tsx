// The design canvas: a reorderable list of the form's fields. Click a row to
// select it (opens the property panel); drag a row to reorder; drop a palette
// item to add. Shows a compact representation, not the live input (that's the
// Preview tab).

import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ColSpan, FieldType } from "../types";
import { getFieldType } from "../fieldTypes";
import { resolveText } from "../text";
import { BREAKPOINTS } from "../layout";
import type { FormModel } from "./useFormModel";
import { ADD_FIELD_MIME } from "./Palette";

// Compact "12 · md 6 · lg 4" summary of a field's responsive width.
function colSpanSummary(colSpan: ColSpan | undefined): string {
  if (!colSpan) return "";
  const parts: string[] = [];
  for (const { key } of BREAKPOINTS) {
    const value = colSpan[key];
    if (value != null) parts.push(key === "base" ? String(value) : `${key} ${value}`);
  }
  return parts.join(" · ");
}

// Drag MIME used to reorder an existing field within the canvas.
const REORDER_MIME = "application/x-ff-reorder";

type CanvasProps = {
  model: FormModel;
  locale: string;
  onAdd: (type: FieldType, defaultTitle: string, index?: number) => void;
};

export default function Canvas({ model, locale, onAdd }: CanvasProps) {
  const { t } = useTranslation("form");
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    // A drop on a row would otherwise also bubble to the container's onDrop,
    // running this twice and adding/moving the field twice.
    event.stopPropagation();
    setDragOver(null);
    const reorder = event.dataTransfer.getData(REORDER_MIME);
    if (reorder !== "") {
      model.moveField(Number(reorder), index);
      return;
    }
    const addType = event.dataTransfer.getData(ADD_FIELD_MIME);
    if (addType) {
      const def = getFieldType(addType as FieldType);
      onAdd(addType as FieldType, def ? t(`designer.types.${def.labelKey}`) : addType, index);
    }
  };

  const allowDrop = (event: DragEvent, index: number) => {
    if (
      event.dataTransfer.types.includes(REORDER_MIME) ||
      event.dataTransfer.types.includes(ADD_FIELD_MIME)
    ) {
      event.preventDefault();
      setDragOver(index);
    }
  };

  if (model.fields.length === 0) {
    return (
      <div
        className="dz-canvas dz-canvas-empty"
        onDragOver={(e) => allowDrop(e, 0)}
        onDrop={(e) => handleDrop(e, 0)}
      >
        <p className="dz-empty-hint">{t("designer.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div
      className="dz-canvas"
      onDragOver={(e) => allowDrop(e, model.fields.length)}
      onDrop={(e) => handleDrop(e, model.fields.length)}
    >
      {model.fields.map((field, index) => {
        const def = getFieldType(field.type);
        const selected = field.name === model.selectedName;
        const title =
          def?.group === "display"
            ? t(`designer.types.${def.labelKey}`)
            : resolveText(field.title, locale) || field.name;
        return (
          <div
            key={field.name}
            className={`dz-row${selected ? " is-selected" : ""}${
              dragOver === index ? " is-drop-target" : ""
            }`}
            draggable
            onClick={() => model.selectField(field.name)}
            onDragStart={(e) => {
              e.dataTransfer.setData(REORDER_MIME, String(index));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => allowDrop(e, index)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, index)}
          >
            <span className="dz-row-handle" aria-hidden="true">⋮⋮</span>
            <span className="dz-row-icon">{def?.icon}</span>
            <span className="dz-row-title">
              {title}
              {field.isRequired && <span className="dz-row-required"> *</span>}
            </span>
            {colSpanSummary(field.colSpan) && (
              <span className="dz-row-cols" title={t("designer.layout.columns")}>
                ▦ {colSpanSummary(field.colSpan)}
              </span>
            )}
            <span className="dz-row-type">
              {def ? t(`designer.types.${def.labelKey}`) : field.type}
            </span>
            <button
              type="button"
              className="dz-row-delete"
              aria-label={t("designer.deleteField")}
              title={t("designer.deleteField")}
              onClick={(e) => {
                e.stopPropagation();
                model.removeField(field.name);
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
