import type { HttpRequest, HttpHeader } from "../../../types/index.ts";

// State and reducer for the RequestModal. All field changes go through
// dispatch so the component stays declarative.

// Derive a camelCase variable name from a human-readable request name.
// "Get Users" → "getUsers", "my request!" → "myRequest"
export function slugifyName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 _]/g, "")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1)))
    .join("") || "response";
}

export type RequestState = {
  name: string;
  nameAr: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  url: string;
  headers: HttpHeader[];
  body: string;
  responsePath: string;
  responseVar: string;
  isList: boolean;
  listItemKey: string;
  listItemLabel: string;
};

export type RequestAction =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_NAME_AR"; value: string }
  | { type: "SET_METHOD"; value: RequestState["method"] }
  | { type: "SET_URL"; value: string }
  | { type: "SET_HEADERS"; headers: HttpHeader[] }
  | { type: "SET_BODY"; value: string }
  | { type: "SET_RESPONSE_PATH"; value: string }
  | { type: "SET_RESPONSE_VAR"; value: string }
  | { type: "SET_IS_LIST"; value: boolean }
  | { type: "SET_LIST_ITEM_KEY"; value: string }
  | { type: "SET_LIST_ITEM_LABEL"; value: string }
  | { type: "RESET"; request: HttpRequest };

export function requestReducer(state: RequestState, action: RequestAction): RequestState {
  switch (action.type) {
    case "SET_NAME": {
      // Auto-update responseVar only while it still matches the auto-slug of the old name.
      const autoUpdated = state.responseVar === slugifyName(state.name);
      return {
        ...state,
        name: action.value,
        responseVar: autoUpdated ? slugifyName(action.value) : state.responseVar,
      };
    }
    case "SET_NAME_AR":     return { ...state, nameAr: action.value };
    case "SET_METHOD":      return { ...state, method: action.value };
    case "SET_URL":         return { ...state, url: action.value };
    case "SET_HEADERS":     return { ...state, headers: action.headers };
    case "SET_BODY":        return { ...state, body: action.value };
    case "SET_RESPONSE_PATH":  return { ...state, responsePath: action.value };
    case "SET_RESPONSE_VAR":   return { ...state, responseVar: action.value };
    case "SET_IS_LIST":        return { ...state, isList: action.value };
    case "SET_LIST_ITEM_KEY":   return { ...state, listItemKey: action.value };
    case "SET_LIST_ITEM_LABEL": return { ...state, listItemLabel: action.value };
    case "RESET":
      return {
        name: action.request.name,
        nameAr: action.request.nameAr ?? "",
        method: action.request.method,
        url: action.request.url,
        headers: action.request.headers ?? [],
        body: action.request.body ?? "",
        responsePath: action.request.responsePath,
        responseVar: action.request.responseVar ?? slugifyName(action.request.name),
        isList: action.request.isList,
        listItemKey: action.request.listItemKey ?? "",
        listItemLabel: action.request.listItemLabel ?? "",
      };
    default:
      return state;
  }
}

export function stateToRequest(id: string, state: RequestState, existingRules: HttpRequest["outputRules"]): HttpRequest {
  return {
    id,
    name: state.name,
    nameAr: state.nameAr || undefined,
    method: state.method as HttpRequest["method"],
    url: state.url,
    headers: state.headers,
    body: state.body || undefined,
    responsePath: state.responsePath,
    responseVar: state.responseVar || undefined,
    isList: state.isList,
    listItemKey: state.listItemKey || undefined,
    listItemLabel: state.listItemLabel || undefined,
    outputRules: existingRules,
  };
}

export const REQUEST_INIT: RequestState = {
  name: "",
  nameAr: "",
  method: "GET",
  url: "",
  headers: [],
  body: "",
  responsePath: "",
  responseVar: "",
  isList: false,
  listItemKey: "",
  listItemLabel: "",
};
