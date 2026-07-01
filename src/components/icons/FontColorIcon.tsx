export function FontColorIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16" strokeWidth="3" stroke={color} />
      <path d="M8 16L12 4l4 12" />
      <path d="M9.5 12h5" />
    </svg>
  );
}
