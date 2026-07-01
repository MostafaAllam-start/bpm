import { useReducer, useEffect } from "react";
import { useTranslation } from "react-i18next";

import BpmnModal from "../../BpmnModal/index.ts";
import { HeadersEditor } from "../HeadersEditor.tsx";
import VarMentionInput from "../VarMentionInput.tsx";
import type { HttpRequest } from "../../../types/index.ts";
import type { AvailableVariable } from "../../../utils/variables.ts";
import { requestReducer, REQUEST_INIT, stateToRequest, type RequestState } from "./requestReducer.ts";

const HTTP_METHODS: RequestState["method"][] = [
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
];

type RequestModalProps = {
  open: boolean;
  request: HttpRequest;
  availableVars?: AvailableVariable[];
  onApply: (updated: HttpRequest) => void;
  onClose: () => void;
};

export default function RequestModal({
  open,
  request,
  availableVars = [],
  onApply,
  onClose,
}: RequestModalProps) {
  const { t, i18n } = useTranslation("bpmn");
  const [state, dispatch] = useReducer(requestReducer, REQUEST_INIT);

  useEffect(() => {
    dispatch({ type: "RESET", request });
  }, [request.id]);

  const isAr = i18n.language.startsWith("ar");
  const modalTitle = isAr
    ? (state.nameAr || state.name || t("props.httpRequestName"))
    : (state.name || t("props.httpRequestName"));

  const hasBody =
    state.method === "POST" || state.method === "PUT" || state.method === "PATCH";
  const canApply = state.name.trim().length > 0 && state.url.trim().length > 0;

  return (
    <BpmnModal
      open={open}
      title={modalTitle}
      onClose={onClose}
      onApply={() => onApply(stateToRequest(request.id, state, request.outputRules))}
      applyDisabled={!canApply}
    >
      <div className="bf-req-modal-fields">
        {/* Name (EN) */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">
            {t("props.httpRequestName")} — {t("props.langEn")}
          </span>
          <VarMentionInput
            value={state.name}
            placeholder="e.g. Get user"
            availableVars={availableVars}
            onChange={(v) => dispatch({ type: "SET_NAME", value: v })}
          />
        </div>

        {/* Name (AR) */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">
            {t("props.httpRequestName")} — {t("props.langAr")}
          </span>
          <VarMentionInput
            value={state.nameAr}
            placeholder="مثال: جلب المستخدم"
            availableVars={availableVars}
            dir="rtl"
            onChange={(v) => dispatch({ type: "SET_NAME_AR", value: v })}
          />
        </div>

        {/* Method */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.httpMethod")}</span>
          <select
            value={state.method}
            onChange={(e) =>
              dispatch({ type: "SET_METHOD", value: e.target.value as RequestState["method"] })
            }
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* URL */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.httpUrl")}</span>
          <VarMentionInput
            value={state.url}
            placeholder="https://api.example.com/data"
            availableVars={availableVars}
            onChange={(v) => dispatch({ type: "SET_URL", value: v })}
          />
        </div>

        {/* Headers */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.httpHeaders")}</span>
          <HeadersEditor
            headers={state.headers}
            onChange={(headers) => dispatch({ type: "SET_HEADERS", headers })}
          />
        </div>

        {/* Body — only for methods that carry a body */}
        {hasBody && (
          <div className="bf-prop-field">
            <span className="bf-prop-label">{t("props.httpBody")}</span>
            <VarMentionInput
              value={state.body}
              placeholder='{"key": "{varName}"}'
              availableVars={availableVars}
              multiline
              onChange={(v) => dispatch({ type: "SET_BODY", value: v })}
            />
          </div>
        )}

        {/* Response path */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.httpResponsePath")}</span>
          <input
            value={state.responsePath}
            placeholder="data.items"
            onChange={(e) => dispatch({ type: "SET_RESPONSE_PATH", value: e.target.value })}
          />
        </div>

        {/* Response variable — the process variable name that holds the full response */}
        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.httpResponseVar")}</span>
          <input
            value={state.responseVar}
            placeholder="response"
            onChange={(e) => dispatch({ type: "SET_RESPONSE_VAR", value: e.target.value })}
          />
        </div>

        {/* Is list checkbox — shrinks to content width */}
        <div className="bf-prop-field bf-prop-field--fit">
          <label className="bf-prop-checkbox-label">
            <input
              type="checkbox"
              className="bf-req-checkbox"
              checked={state.isList}
              onChange={(e) => dispatch({ type: "SET_IS_LIST", value: e.target.checked })}
            />
            {t("props.httpIsList")}
          </label>
        </div>

        {/* Key + display fields — side by side, only when isList */}
        {state.isList && (
          <>
            <div className="bf-prop-field">
              <span className="bf-prop-label">{t("props.httpListItemKey")}</span>
              <input
                value={state.listItemKey}
                placeholder="id"
                onChange={(e) => dispatch({ type: "SET_LIST_ITEM_KEY", value: e.target.value })}
              />
            </div>
            <div className="bf-prop-field">
              <span className="bf-prop-label">{t("props.httpListItemLabel")}</span>
              <input
                value={state.listItemLabel}
                placeholder="name"
                onChange={(e) => dispatch({ type: "SET_LIST_ITEM_LABEL", value: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
    </BpmnModal>
  );
}
