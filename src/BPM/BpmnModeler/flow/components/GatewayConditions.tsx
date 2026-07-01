import { useState } from "react";
import { useTranslation } from "react-i18next";

import { availableVariablesAt, humanizeExpression, segmentExpression } from "../utils/variables.ts";
import { AR_SUFFIX } from "../utils/localizedText.ts";
import type { FlowModeler } from "../hooks/useFlowModeler.ts";
import type { BpmnEdge } from "../types/index.ts";
import type { SavedActorForm } from "../../types.ts";
import ConditionModal from "./ConditionModal.tsx";

type GatewayConditionsProps = {
  modeler: FlowModeler;
  gatewayId: string;
  savedActorForms: Record<string, SavedActorForm>;
};

// Gateway-centric view of its outgoing branch conditions. Each branch card has
// inline editable EN/AR name inputs, a condition summary, and an "Edit
// conditions" button that opens the modal. The default-flow radio is toggled
// directly on the card.
export default function GatewayConditions({
  modeler,
  gatewayId,
  savedActorForms,
}: GatewayConditionsProps) {
  const { t } = useTranslation("bpmn");

  // Which edge's condition modal is open (null = none).
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  const outgoing = modeler.edges.filter((e) => e.source === gatewayId);

  const variables = availableVariablesAt({
    nodes: modeler.nodes,
    edges: modeler.edges,
    savedActorForms,
    globals: modeler.processMeta.processVariables,
    nodeId: gatewayId,
  });

  const branchTarget = (edge: BpmnEdge): string => {
    const target = modeler.nodes.find((n) => n.id === edge.target);
    return target?.data.name?.trim() || edge.target;
  };

  // Only one default flow per gateway — marking one clears it on the rest.
  const setDefault = (edgeId: string, isDefault: boolean) => {
    for (const e of outgoing) {
      const next = isDefault && e.id === edgeId;
      if (Boolean(e.data?.isDefault) !== next) {
        modeler.updateEdgeData(e.id, { isDefault: next });
      }
    }
  };

  const editingEdge = editingEdgeId
    ? outgoing.find((e) => e.id === editingEdgeId) ?? null
    : null;

  return (
    <>
      <div className="bf-prop-subtitle">{t("props.gatewayConditions")}</div>

      {outgoing.length === 0 ? (
        <p className="bf-var-hint">{t("props.gatewayNoFlows")}</p>
      ) : (
        <div className="bf-gateway-flows">
          {outgoing.map((edge) => {
            const nameEn = edge.data?.name ?? "";
            const nameAr = edge.data?.props?.[`name${AR_SUFFIX}`] ?? "";
            const expr = edge.data?.conditionExpression ?? "";
            const isDefault = Boolean(edge.data?.isDefault);
            const target = branchTarget(edge);

            return (
              <div key={edge.id} className="bf-gateway-flow">
                {/* Branch target header */}
                <div className="bf-gateway-flow-target" title={target}>
                  {target}
                </div>

                {/* Inline editable bilingual name */}
                <div className="bf-prop-bilingual bf-gateway-flow-name-edit">
                  <div className="bf-prop-lang" dir="ltr">
                    <span className="bf-prop-lang-tag">{t("props.langEn")}</span>
                    <input
                      key={`en-${edge.id}`}
                      defaultValue={nameEn}
                      placeholder={t("props.flowLabelPlaceholder")}
                      onBlur={(e) => {
                        if (e.target.value !== nameEn) {
                          modeler.updateEdgeData(edge.id, { name: e.target.value });
                        }
                      }}
                    />
                  </div>
                  <div className="bf-prop-lang" dir="rtl">
                    <span className="bf-prop-lang-tag">{t("props.langAr")}</span>
                    <input
                      key={`ar-${edge.id}`}
                      defaultValue={nameAr}
                      placeholder={t("props.flowLabelPlaceholder")}
                      onBlur={(e) => {
                        if (e.target.value !== nameAr) {
                          modeler.updateEdgeData(edge.id, {
                            props: {
                              ...(edge.data?.props ?? {}),
                              [`name${AR_SUFFIX}`]: e.target.value,
                            },
                          });
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Condition summary */}
                <div className="bf-cond-summary" title={humanizeExpression(expr, variables)}>
                  {expr
                    ? segmentExpression(expr, variables).map((seg, i) =>
                        seg.kind === "var"
                          ? <span key={i} className="bf-cond-var-chip">{seg.display}</span>
                          : <span key={i}>{seg.text}</span>
                      )
                    : t("props.noCondition")}
                </div>

                {/* Actions row */}
                <div className="bf-gateway-flow-actions">
                  <button
                    type="button"
                    className="bf-cond-edit-btn"
                    onClick={() => setEditingEdgeId(edge.id)}
                  >
                    {t("props.editConditions")}
                  </button>

                  <label className="bf-prop-checkbox">
                    <input
                      type="radio"
                      name={`default-${gatewayId}`}
                      checked={isDefault}
                      onChange={() => setDefault(edge.id, true)}
                    />
                    <span>{t("props.defaultFlow")}</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Condition edit modal — only conditions, name/default managed in the card */}
      {editingEdge && (
        <ConditionModal
          title={
            editingEdge.data?.name ||
            editingEdge.data?.props?.[`name${AR_SUFFIX}`] ||
            branchTarget(editingEdge)
          }
          value={editingEdge.data?.conditionExpression ?? ""}
          variables={variables}
          onApply={(expression) => {
            modeler.updateEdgeData(editingEdgeId!, {
              conditionExpression: expression,
            });
            setEditingEdgeId(null);
          }}
          onClose={() => setEditingEdgeId(null)}
        />
      )}
    </>
  );
}
