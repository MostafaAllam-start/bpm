import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnElementType } from "../types/index.ts";
import { TaskIcon, GatewaySymbol } from "../nodes/nodeIcons.tsx";

// The MIME-ish key used to carry the element type through an HTML5 drag.
export const PALETTE_DND_TYPE = "application/bpmn-flow-node";

// The element types offered in the palette, grouped the way bpmn-js grouped its
// palette entries. Clicking an entry drops it at the canvas center; dragging it
// drops it where released.
const GROUPS: { titleKey: string; types: BpmnElementType[] }[] = [
  { titleKey: "palette.groupTasks", types: ["userTask", "serviceTask", "manualTask", "scriptTask", "sendTask", "receiveTask", "businessRuleTask"] },
  { titleKey: "palette.groupEvents", types: ["startEvent", "endEvent", "intermediateThrowEvent", "intermediateCatchEvent"] },
  { titleKey: "palette.groupGateways", types: ["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway"] },
];

// A miniature of the shape for the palette button. Exported so the properties
// panel can show the same glyph in its header.
export function PaletteGlyph({ type }: { type: BpmnElementType }) {
  const category = ELEMENT_SPECS[type].category;
  if (category === "event") {
    return <span className={`bf-pal-event bf-event-${type}`} />;
  }
  if (category === "gateway") {
    return (
      <span className="bf-pal-gateway">
        <span className="bf-pal-gateway-diamond" />
        <span className="bf-pal-gateway-symbol">
          <GatewaySymbol type={type} />
        </span>
      </span>
    );
  }
  return (
    <span className="bf-pal-task">
      <TaskIcon type={type} />
    </span>
  );
}

type PaletteProps = {
  onAdd: (type: BpmnElementType) => void;
};

export default function Palette({ onAdd }: PaletteProps) {
  const { t } = useTranslation("bpmn");

  return (
    <aside className="bf-palette" aria-label={t("palette.title")}>
      {GROUPS.map((group) => (
        <div key={group.titleKey} className="bf-pal-group">
          <div className="bf-pal-group-title">{t(group.titleKey)}</div>
          {group.types.map((type) => (
            <button
              key={type}
              type="button"
              className="bf-pal-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PALETTE_DND_TYPE, type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(type)}
              title={t(ELEMENT_SPECS[type].labelKey)}
            >
              <PaletteGlyph type={type} />
              <span className="bf-pal-label">{t(ELEMENT_SPECS[type].labelKey)}</span>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
