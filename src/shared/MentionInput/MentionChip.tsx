// DOM helper for inserting a chip into a live contentEditable surface.
// Cannot use React.createElement here because the chip is inserted during a
// DOM mutation (inside a Selection range operation).
export function makeChip(token: string, label: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "mention-chip";
  span.contentEditable = "false";
  span.dataset.token = token;
  span.textContent = label;
  return span;
}

// React component for rendering a chip in a read-only/display context.
// Does NOT set contentEditable or data-token — those are only needed inside
// an active contentEditable editor (use makeChip for that).
export default function MentionChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={`mention-chip${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}
