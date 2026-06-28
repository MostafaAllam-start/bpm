import { createPortal } from "react-dom";
import type { MentionGroup, MentionVar } from "./types";

type Props = {
  groups: MentionGroup[];
  flat: MentionVar[];
  activeIndex: number;
  anchor: { left: number; top: number; width: number };
  onSelect: (v: MentionVar) => void;
  onHover: (idx: number) => void;
};

export default function MentionDropdown({
  groups,
  flat,
  activeIndex,
  anchor,
  onSelect,
  onHover,
}: Props) {
  return createPortal(
    <div
      className="mention-dropdown"
      style={{
        position: "fixed",
        left: anchor.left,
        top: anchor.top,
        width: Math.max(anchor.width, 200),
      }}
    >
      {groups.map((g) => (
        <div key={g.key} className="mention-group">
          <div className="mention-group-label">{g.label}</div>
          {g.vars.map((v) => {
            const idx = flat.indexOf(v);
            return (
              <button
                key={v.ref ?? v.name}
                type="button"
                className={`mention-item${idx === activeIndex ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => onHover(idx)}
                onClick={() => onSelect(v)}
              >
                <span className="mention-name">{v.name}</span>
                {v.meta && <span className="mention-type">{v.meta}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    document.body,
  );
}
