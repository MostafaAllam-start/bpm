// Shared colour presets for the properties panel and the node context pad. Each
// entry is a fill + matching stroke (borrowed from bpmn-js-color-picker); the
// `none` preset clears both back to the default shape colours.
export type ColorPreset = { key: string; fill?: string; stroke?: string };

export const COLOR_PRESETS: ColorPreset[] = [
  { key: "none" },
  { key: "blue", fill: "#bbdefb", stroke: "#1e88e5" },
  { key: "green", fill: "#c8e6c9", stroke: "#43a047" },
  { key: "orange", fill: "#ffe0b2", stroke: "#fb8c00" },
  { key: "red", fill: "#ffcdd2", stroke: "#e53935" },
  { key: "purple", fill: "#e1bee7", stroke: "#8e24aa" },
];

// The next preset after the one currently applied (by fill), wrapping around.
// Used by the context pad's colour button to cycle through the palette.
export function nextColorPreset(currentFill?: string): ColorPreset {
  const index = COLOR_PRESETS.findIndex((c) => c.fill === currentFill);
  return COLOR_PRESETS[(index + 1) % COLOR_PRESETS.length];
}
