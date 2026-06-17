import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

// A generic right-click menu rendered at a screen position. FlowCanvas composes
// the item list for the thing that was clicked (a node, an edge, or the empty
// pane); this component just renders and dismisses it.

// The glyph shown before a menu item's label (optional).
export type MenuIcon =
  | "duplicate"
  | "copy"
  | "paste"
  | "delete"
  | "actor"
  | "form"
  | "layout"
  | "fit";

export type MenuItem =
  | "separator"
  | {
      labelKey: string;
      onClick: () => void;
      icon?: MenuIcon;
      danger?: boolean;
      disabled?: boolean;
    };

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Inline glyphs for the menu actions, keyed by `MenuIcon`.
const MENU_ICONS: Record<MenuIcon, () => React.ReactNode> = {
  duplicate: () => (
    <svg {...iconProps}>
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V9z" />
    </svg>
  ),
  copy: () => (
    <svg {...iconProps}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  ),
  paste: () => (
    <svg {...iconProps}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  delete: () => (
    <svg {...iconProps}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  actor: () => (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
    </svg>
  ),
  form: () => (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  layout: () => (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M10 6.5h4a2 2 0 0 1 2 2v5" />
    </svg>
  ),
  fit: () => (
    <svg {...iconProps}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
};

export type ContextMenuState = { x: number; y: number; items: MenuItem[] };

type ContextMenuProps = {
  menu: ContextMenuState;
  onClose: () => void;
};

export default function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const { t } = useTranslation("bpmn");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="bf-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) =>
        item === "separator" ? (
          <div key={`sep-${i}`} className="bf-context-menu-sep" />
        ) : (
          <button
            key={item.labelKey}
            type="button"
            className={`bf-context-menu-item${item.danger ? " bf-context-menu-danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon && (
              <span className="bf-context-menu-icon">{MENU_ICONS[item.icon]()}</span>
            )}
            {t(item.labelKey)}
          </button>
        ),
      )}
    </div>
  );
}
