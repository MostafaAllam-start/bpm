// Place a text cursor at a client-space point inside a contentEditable element,
// handling both caretRangeFromPoint (Chrome/Safari) and caretPositionFromPoint
// (Firefox). Returns null when the point doesn't resolve to a caret within
// `container`. Shared by the inline text editors so a click that opens edit mode
// lands the caret exactly where the user clicked.
export function caretAtPoint(
  x: number,
  y: number,
  container: HTMLElement,
): Range | null {
  type DocExt = Document & {
    caretRangeFromPoint?(x: number, y: number): Range | null;
    caretPositionFromPoint?(
      x: number,
      y: number,
    ): { offsetNode: Node; offset: number } | null;
  };
  const doc = document as DocExt;
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r && container.contains(r.startContainer)) return r;
  }
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos && container.contains(pos.offsetNode)) {
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
  }
  return null;
}
