export function HighlightColorIcon({ color = "#ffff00" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="18" width="18" height="3" rx="1" fill={color} stroke="none" />
      <path d="M9.5 15l-2-5 5-5 5 5-2 5z" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </svg>
  );
}
