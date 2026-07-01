export function TextDirectionRtlIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* text lines, right-anchored */}
      <path d="M20 6H4" />
      <path d="M20 11H9" />
      {/* direction of flow: arrow pointing left */}
      <path d="M20 17H8" />
      <path d="m10 14-3 3 3 3" />
    </svg>
  );
}
