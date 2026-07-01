// Bilingual free-text support for diagram elements. Each translatable field is
// authored as a default (English) value plus an Arabic variant. The default is
// stored as today — the native BPMN attribute (`name`) or a bare `ecmplus` prop
// (`description`, `notes`) — while the Arabic variant lives in a parallel prop
// suffixed `Ar` (`nameAr`, `descriptionAr`, `notesAr`). Both round-trip through
// the XML for free: the default as its native attribute, the Arabic as an
// `ecmplus:*` prop (see `readEcmProps` / `ecmAttrs`).
//
// `localizedValue` picks the value to *display* for the active app language; the
// properties panel always edits both sides explicitly, so it doesn't use this.

// Suffix marking the Arabic variant of a translatable field (e.g. `nameAr`).
export const AR_SUFFIX = "Ar";

// Resolve the text to show for the current language, falling back to the other
// language when the preferred side is blank so an element is never unlabelled.
export function localizedValue(
  base: string | undefined,
  ar: string | undefined,
  language: string,
): string {
  const wantArabic = language.toLowerCase().startsWith("ar");
  const primary = (wantArabic ? ar : base)?.trim();
  if (primary) return primary;
  return (wantArabic ? base : ar)?.trim() ?? "";
}
