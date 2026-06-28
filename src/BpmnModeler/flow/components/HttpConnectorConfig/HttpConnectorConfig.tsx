import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { FlowModeler } from "../../hooks/useFlowModeler";
import type { SavedActorForm } from "../../../types";
import type { HttpRequest } from "../../types";
import { parseRequests, serializeRequests } from "../../utils/httpConnector";
import { availableVariablesAt, seedVariables } from "../../utils/variables";
import RequestModal from "./RequestModal";
import OutputMappingModal from "./OutputMappingModal";

type Props = {
  props: Record<string, string>;
  setProp: (name: string, value: string) => void;
  modeler: FlowModeler;
  savedActorForms: Record<string, SavedActorForm>;
};

function defaultRequest(): HttpRequest {
  return {
    id: crypto.randomUUID(),
    name: "Request 1",
    nameAr: "طلب 1",
    method: "GET",
    url: "",
    headers: [],
    responsePath: "",
    isList: false,
    outputRules: [],
  };
}

export default function HttpConnectorConfig({
  props,
  setProp,
  modeler,
  savedActorForms,
}: Props) {
  const { t } = useTranslation("bpmn");

  const requests = parseRequests(props.httpRequests, props);
  const request = requests[0] ?? null;

  useEffect(() => {
    if (!request) {
      setProp("httpRequests", serializeRequests([defaultRequest()]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.httpRequests]);

  const save = (updated: HttpRequest) =>
    setProp("httpRequests", serializeRequests([updated]));

  const [editingOpen, setEditingOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  const selectedNodeId = modeler.selectedNode?.id ?? "";
  const availableVars = selectedNodeId
    ? availableVariablesAt({
        nodes: modeler.nodes,
        edges: modeler.edges,
        savedActorForms,
        globals: modeler.processMeta.processVariables,
        nodeId: selectedNodeId,
        excludeSelf: true,
      })
    : [];

  // For the output mapping modal, also expose each request's responseVar so
  // users can reference the full response object in conditions and values.
  const requestVars = requests
    .filter((r) => r.responseVar)
    .map((r) => ({
      name: r.responseVar!,
      ref: r.responseVar!,
      type: "object",
      origin: "task" as const,
      source: r.name,
    }));
  const availableVarsForMapping = [...availableVars, ...requestVars];

  if (!request) return null;

  const rulesCount = request.outputRules.length;
  const mappedVars = request.outputRules
    .map((r) => r.targetVar)
    .filter(Boolean)
    .join(", ");

  const metaParts: string[] = [];
  if (request.headers.length > 0)
    metaParts.push(`${request.headers.length} ${t("props.httpHeaders").toLowerCase()}`);
  if (request.responsePath)
    metaParts.push(`path: ${request.responsePath}`);
  if (request.isList)
    metaParts.push(t("props.httpIsList"));

  return (
    <div className="bf-http-config">
      {/* ── Request card ── */}
      <div className="bf-http-card">
        <div className="bf-http-card-head">
          <span className="bf-http-card-title">{t("props.httpSectionRequest")}</span>
          <button
            type="button"
            className="bf-http-edit-btn"
            onClick={() => setEditingOpen(true)}
          >
            {t("props.httpEditRequest")}
          </button>
        </div>

        <div className="bf-http-card-body">
          <div className="bf-http-method-url">
            <span className="bf-req-method">{request.method}</span>
            {request.url
              ? <span className="bf-http-url-text" title={request.url}>{request.url}</span>
              : <span className="bf-http-url-empty">{t("props.httpUrlPlaceholder")}</span>}
          </div>

          {metaParts.length > 0 && (
            <div className="bf-http-meta">
              {metaParts.map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="bf-http-meta-dot">·</span>}
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Output mappings card ── */}
      <div className="bf-http-card">
        <div className="bf-http-card-head">
          <span className="bf-http-card-title">{t("props.httpOutputRules")}</span>
          <button
            type="button"
            className="bf-http-edit-btn"
            onClick={() => setMappingOpen(true)}
          >
            {rulesCount > 0 ? `${rulesCount} ${t("props.httpEditMappings")}` : t("props.httpEditMappings")}
          </button>
        </div>

        {mappedVars ? (
          <div className="bf-http-card-body">
            <div className="bf-http-mapped-vars">{mappedVars}</div>
          </div>
        ) : (
          <div className="bf-http-card-empty">{t("props.httpNoMappings")}</div>
        )}
      </div>

      {editingOpen && (
        <RequestModal
          open
          request={request}
          availableVars={availableVars}
          onApply={(updated) => { save(updated); setEditingOpen(false); }}
          onClose={() => setEditingOpen(false)}
        />
      )}

      {mappingOpen && (
        <OutputMappingModal
          open
          request={request}
          allRequests={[request]}
          availableVars={availableVarsForMapping}
          processVars={seedVariables(modeler.processMeta.processVariables)}
          onApply={(rules) => { save({ ...request, outputRules: rules }); setMappingOpen(false); }}
          onClose={() => setMappingOpen(false)}
        />
      )}
    </div>
  );
}
