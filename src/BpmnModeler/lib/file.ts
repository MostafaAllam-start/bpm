// Pull a human-readable message out of an unknown thrown value.
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Trigger a browser download for a string of text (BPMN XML or SVG markup).
export function downloadFile(
  name: string,
  data: string,
  mimeType: string,
): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
