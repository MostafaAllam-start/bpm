// The field palette. Lists every registered field type grouped by category;
// click (or drag onto the canvas) to add. Labels come from i18n.

import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FieldType } from "../types";
import { FIELD_TYPES, type FieldTypeDef } from "../utils/fieldTypes";
import { useDesignerMode } from "./DesignerModeContext";

// Drag MIME used to add a new field by dropping a palette item on the canvas.
export const ADD_FIELD_MIME = "application/x-ff-add";

type PaletteProps = {
  onAdd: (type: FieldType, defaultTitle: string) => void;
};

const GROUP_ORDER: FieldTypeDef["group"][] = ["input", "choice", "display"];

// Display items are split into sub-groups so the section stays scannable at 11+ items.
const DISPLAY_SUBGROUPS: Array<{ key: string; types: FieldType[] }> = [
  { key: "structure", types: ["group", "divider"] },
  { key: "content",   types: ["heading", "dynamictext", "html", "image", "signature", "iframe"] },
  { key: "data",      types: ["table", "orderedlist", "unorderedlist"] },
  { key: "action",    types: ["button"] },
];

export default function Palette({ onAdd }: PaletteProps) {
  const { t } = useTranslation("form");
  const mode = useDesignerMode();
  const isDocMode = mode === "email" || mode === "pdf";

  const byType = new Map(FIELD_TYPES.map((def) => [def.type, def]));

  const allowedGroups = isDocMode
    ? (GROUP_ORDER.filter((g) => g === "display") as FieldTypeDef["group"][])
    : GROUP_ORDER;

  const docHidden = new Set(isDocMode ? ["iframe"] : []);

  const grouped = allowedGroups.map((group) => ({
    group,
    items: FIELD_TYPES.filter((def) => def.group === group && !docHidden.has(def.type)),
  })).filter((g) => g.items.length > 0);

  const labelOf = (def: FieldTypeDef) => t(`designer.types.${def.labelKey}`);

  const handleDragStart = (event: DragEvent, def: FieldTypeDef) => {
    event.dataTransfer.setData(ADD_FIELD_MIME, def.type);
    event.dataTransfer.effectAllowed = "copy";
  };

  const renderItem = (def: FieldTypeDef) => (
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
  );

  return (
    <aside className="dz-palette">
      <h3 className="dz-palette-title">{t("designer.paletteTitle")}</h3>
      {grouped.map(({ group, items }) => (
        <div key={group} className="dz-palette-group">
          <span className="dz-palette-group-label">
            {t(`designer.groups.${group}`)}
          </span>
          {group === "display"
            ? DISPLAY_SUBGROUPS.map(({ key, types }) => {
                const subItems = types
                  .filter((type) => !docHidden.has(type))
                  .map((type) => byType.get(type))
                  .filter((def): def is FieldTypeDef => def != null);
                if (!subItems.length) return null;
                return (
                  <div key={key} className="dz-palette-subgroup">
                    <span className="dz-palette-subgroup-label">
                      {t(`designer.subgroups.${key}`)}
                    </span>
                    {subItems.map(renderItem)}
                  </div>
                );
              })
            : items.map(renderItem)}
        </div>
      ))}
    </aside>
  );
}
