import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SelectableModule } from "../modules.ts";

type ModuleMenuProps = {
  modules: SelectableModule[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SlidersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}

// Toolbar dropdown that lets the user pick which optional bpmn-js add-ons are
// active. Toggling an entry rebuilds the modeler with the new module set (the
// work happens in `useBpmnModeler`); this component is pure presentation plus
// its own open/close state.
export default function ModuleMenu({
  modules,
  selectedIds,
  onToggle,
}: ModuleMenuProps) {
  const { t } = useTranslation("bpmn");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="bpmn-module-menu" ref={rootRef}>
      <button
        type="button"
        className="tb-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersIcon />
        {t("modules.title")}
      </button>

      {open && (
        <div className="bpmn-module-dropdown" role="menu">
          {modules.map((module) => (
            <label key={module.id} className="bpmn-module-item">
              <input
                type="checkbox"
                checked={selectedIds.includes(module.id)}
                onChange={() => onToggle(module.id)}
              />
              <span>{t(module.labelKey)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
