// The inline typography style for the form title, derived from its style props.
// Shared by the designer's TitleContainer (canvas preview) and the runtime
// FormRenderer so the rendered title matches what was designed. Kept dependency-
// free (no React component, no interact.js) so the runtime can import it.

import type { CSSProperties } from "react";

import type { FormTitle } from "../types";

export function titleTextStyle(style: FormTitle | undefined): CSSProperties {
  return {
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    fontFamily: style?.fontFamily || undefined,
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    color: style?.color || undefined,
  };
}
