export type TextFormatState = {
  pos: { x: number; y: number } | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: string;
  fontColor: string;
  bgColor: string;
  align: "left" | "center" | "right" | null;
  dir: "ltr" | "rtl" | null;
};

export const initialTextFormatState: TextFormatState = {
  pos: null,
  bold: false,
  italic: false,
  underline: false,
  fontSize: "14",
  fontColor: "#000000",
  bgColor: "#ffff00",
  align: null,
  dir: null,
};

export type TextFormatAction =
  | {
      type: "SHOW";
      x: number;
      y: number;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      align: "left" | "center" | "right" | null;
      dir: "ltr" | "rtl" | null;
    }
  | { type: "HIDE" }
  | { type: "SET_FONT_SIZE"; value: string }
  | { type: "SET_FONT_COLOR"; value: string }
  | { type: "SET_BG_COLOR"; value: string }
  | { type: "SET_DIR"; value: "ltr" | "rtl" }
  // fontSize and dir are derived from the DOM at call-time; undefined means unchanged.
  | { type: "REFRESH_STATES"; fontSize?: string; dir?: "ltr" | "rtl" | null };

function queryAlign(): "left" | "center" | "right" | null {
  if (document.queryCommandState("justifyLeft")) return "left";
  if (document.queryCommandState("justifyCenter")) return "center";
  if (document.queryCommandState("justifyRight")) return "right";
  return null;
}

export function textFormatReducer(
  state: TextFormatState,
  action: TextFormatAction,
): TextFormatState {
  switch (action.type) {
    case "SHOW":
      return {
        ...state,
        pos: { x: action.x, y: action.y },
        bold: action.bold,
        italic: action.italic,
        underline: action.underline,
        align: action.align,
        dir: action.dir,
      };
    case "HIDE":
      return { ...state, pos: null };
    case "SET_FONT_SIZE":
      return { ...state, fontSize: action.value };
    case "SET_FONT_COLOR":
      return { ...state, fontColor: action.value };
    case "SET_BG_COLOR":
      return { ...state, bgColor: action.value };
    case "SET_DIR":
      return { ...state, dir: action.value };
    case "REFRESH_STATES":
      return {
        ...state,
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        fontSize: action.fontSize ?? state.fontSize,
        align: queryAlign(),
        dir: "dir" in action ? (action.dir ?? null) : state.dir,
      };
    default:
      return state;
  }
}
