// The field palette. Lists every registered field type grouped by category;
// click (or drag onto the canvas) to add. Labels come from i18n.

import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FieldType } from "../types";
import { FIELD_TYPES, type FieldTypeDef } from "../fieldTypes";

// Drag MIME used to add a new field by dropping a palette item on the canvas.
export const ADD_FIELD_MIME = "application/x-ff-add";

type PaletteProps = {
  onAdd: (type: FieldType, defaultTitle: string) => void;
};

const GROUP_ORDER: FieldTypeDef["group"][] = ["input", "choice", "display"];

export default function Palette({ onAdd }: PaletteProps) {
  const { t } = useTranslation("form");

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: FIELD_TYPES.filter((def) => def.group === group),
  })).filter((g) => g.items.length > 0);

  const labelOf = (def: FieldTypeDef) => t(`designer.types.${def.labelKey}`);

  const handleDragStart = (event: DragEvent, def: FieldTypeDef) => {
    event.dataTransfer.setData(ADD_FIELD_MIME, def.type);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="dz-palette">
      <h3 className="dz-palette-title">{t("designer.paletteTitle")}</h3>
      {grouped.map(({ group, items }) => (
        <div key={group} className="dz-palette-group">
          <span className="dz-palette-group-label">
            {t(`designer.groups.${group}`)}
          </span>
          {items.map((def) => (
            <button
              key={def.type}
              type="button"
              className="dz-palette-item"
              draggable
              onDragStart={(e) => handleDragStart(e, def)}
              onClick={() => onAdd(def.type, labelOf(def))}
            >
              <span className="dz-palette-icon">{def.icon}</span>
              <span className="dz-palette-label">{labelOf(def)}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
