import type { CSSProperties } from "react";

// Label appearance is stored as flat `ecmplus:*` props on the node/edge (so it
// round-trips through the BPMN XML like the other custom attributes). These
// helpers read those props into a CSS style object and describe the editable
// fields the properties panel exposes.

export const LABEL_PROP_KEYS = [
  "labelColor",
  "labelFontSize",
  "labelBold",
  "labelItalic",
  "labelFontFamily",
] as const;

// Build the inline style for a label from its element's props.
export function labelStyleFrom(props: Record<string, string> | undefined): CSSProperties {
  const p = props ?? {};
  const style: CSSProperties = {};
  if (p.labelColor) style.color = p.labelColor;
  if (p.labelFontSize) style.fontSize = `${p.labelFontSize}px`;
  if (p.labelBold === "true") style.fontWeight = 700;
  if (p.labelItalic === "true") style.fontStyle = "italic";
  if (p.labelFontFamily) style.fontFamily = p.labelFontFamily;
  return style;
}

// Font families offered in the label properties (value = CSS font-family).
export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Monospace" },
];
