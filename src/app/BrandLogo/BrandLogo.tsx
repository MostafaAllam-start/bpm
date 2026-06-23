// The product brand glyph — two offset rounded rectangles joined by a connector.
// Shared by the app header and the login card; it draws in `currentColor` so each
// host controls size/color through its own wrapper element + class.
export default function BrandLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="4" width="7" height="6" rx="1.6" fill="currentColor" />
      <rect
        x="14.5"
        y="14"
        width="7"
        height="6"
        rx="1.6"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M9.5 7H14a2 2 0 0 1 2 2v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
