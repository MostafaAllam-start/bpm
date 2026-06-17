import type { BpmnElementType } from "../types/index.ts";

// Small inline glyphs drawn inside task / gateway / event shapes, mirroring the
// bpmn-font icons the old bpmn-js renderer used. Kept as plain SVG so they take
// `currentColor` and scale with the shape.

// Centre glyph for an event circle: a play triangle for the start event, a stop
// square for the end event, and a thin ring for intermediate events.
export function EventIcon({ type }: { type: BpmnElementType }): React.ReactNode {
  if (type === "startEvent") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path d="M5 3.5l7 4.5-7 4.5z" fill="currentColor" />
      </svg>
    );
  }
  if (type === "endEvent") {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden>
      <circle cx="8" cy="8" r="4.5" />
    </svg>
  );
}

// Task-type corner markers (top-left of a task box), BPMN-style.
export function TaskIcon({ type }: { type: BpmnElementType }): React.ReactNode {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "userTask":
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="5" r="2.4" />
          <path d="M3.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        </svg>
      );
    case "serviceTask":
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" />
        </svg>
      );
    case "scriptTask":
      return (
        <svg {...common} aria-hidden>
          <path d="M5 3c-1.5 0-1.5 2.5 0 2.5S6.5 8 5 8M4 3h6M6 5.5h5M5 8h6M7 10.5h4" />
        </svg>
      );
    case "sendTask":
      return (
        <svg {...common} aria-hidden>
          <rect x="2.5" y="4" width="11" height="8" rx="1" />
          <path d="M2.5 4.5L8 9l5.5-4.5" />
        </svg>
      );
    case "receiveTask":
      return (
        <svg {...common} aria-hidden>
          <rect x="2.5" y="4" width="11" height="8" rx="1" />
          <path d="M2.5 5l5.5 4 5.5-4" />
        </svg>
      );
    case "manualTask":
      return (
        <svg {...common} aria-hidden>
          <path d="M5 8V4.5a1 1 0 0 1 2 0V8M7 7V3.5a1 1 0 0 1 2 0V8M9 7.5V4.8a1 1 0 0 1 2 0V10c0 2-1.5 3.5-3.5 3.5S4 12 4 10V8.5" />
        </svg>
      );
    case "businessRuleTask":
      return (
        <svg {...common} aria-hidden>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
          <path d="M2.5 6.5h11M6 6.5v6" />
        </svg>
      );
    default:
      return null;
  }
}

// Gateway centre symbol (drawn over the diamond).
export function GatewaySymbol({ type }: { type: BpmnElementType }): React.ReactNode {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 22 22",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
  };
  switch (type) {
    case "parallelGateway":
      return (
        <svg {...common} aria-hidden>
          <path d="M11 4v14M4 11h14" />
        </svg>
      );
    case "inclusiveGateway":
      return (
        <svg {...common} aria-hidden>
          <circle cx="11" cy="11" r="6" />
        </svg>
      );
    case "eventBasedGateway":
      return (
        <svg {...common} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M11 5l4.2 3-1.6 5h-5.2L6.8 8z" strokeWidth={1.4} />
        </svg>
      );
    case "exclusiveGateway":
    default:
      return (
        <svg {...common} aria-hidden>
          <path d="M6 6l10 10M16 6L6 16" />
        </svg>
      );
  }
}
