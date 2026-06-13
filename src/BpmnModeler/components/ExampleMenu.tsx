import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { localizeExample } from "../examples.ts";
import type { DiagramExample } from "../examples.ts";

type ExampleMenuProps = {
  examples: DiagramExample[];
  onSelect: (xml: string) => void;
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

function TemplateIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

// Toolbar dropdown listing the bundled example diagrams. Picking one imports it
// into the modeler (the work happens in `useDiagramActions.handleLoadExample`);
// this component is pure presentation plus its own open/close state.
export default function ExampleMenu({ examples, onSelect }: ExampleMenuProps) {
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
        <TemplateIcon />
        {t("examples.title")}
      </button>

      {open && (
        <div className="bpmn-module-dropdown" role="menu">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              role="menuitem"
              className="bpmn-module-item bpmn-module-item-action"
              onClick={() => {
                // Bake the current language's node names into the diagram.
                onSelect(localizeExample(example, t));
                setOpen(false);
              }}
            >
              {t(example.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
