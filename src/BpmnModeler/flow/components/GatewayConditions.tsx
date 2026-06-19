import { useTranslation } from "react-i18next";

import { availableVariablesAt } from "../utils/variables.ts";
import type { FlowModeler } from "../hooks/useFlowModeler.ts";
import type { BpmnEdge } from "../types/index.ts";
import type { SavedActorForm } from "../../types.ts";
import FlowConditionBuilder from "./FlowConditionBuilder.tsx";

type GatewayConditionsProps = {
  modeler: FlowModeler;
  gatewayId: string;
  savedActorForms: Record<string, SavedActorForm>;
};

// Edit a data-based gateway's branch conditions from the gateway itself: one
// condition builder per outgoing sequence flow, plus a single default flow.
// The conditions live on the flows (each flow's `conditionExpression`), so this
// is just a gateway-centric view of the same data the edge properties edit —
// handy because a gateway's whole branching logic is then visible in one place.
export default function GatewayConditions({
  modeler,
  gatewayId,
  savedActorForms,
}: GatewayConditionsProps) {
  const { t } = useTranslation("bpmn");

  const outgoing = modeler.edges.filter((e) => e.source === gatewayId);

  // Variables in scope at the gateway: the process globals plus everything
  // produced by tasks upstream of it. Shared by every branch's builder.
  const variables = availableVariablesAt({
    nodes: modeler.nodes,
    edges: modeler.edges,
    savedActorForms,
    globals: modeler.processMeta.processVariables,
    nodeId: gatewayId,
  });

  // Each branch is identified by where it leads: the target's name, else its id.
  const branchTarget = (edge: BpmnEdge): string => {
    const target = modeler.nodes.find((n) => n.id === edge.target);
    return target?.data.name?.trim() || edge.target;
  };

  // A gateway has at most one default flow: marking one clears it on the rest.
  const setDefault = (edgeId: string, isDefault: boolean) => {
    for (const e of outgoing) {
      const next = isDefault && e.id === edgeId;
      if (Boolean(e.data?.isDefault) !== next) {
        modeler.updateEdgeData(e.id, { isDefault: next });
      }
    }
  };

  return (
    <>
      <div className="bf-prop-subtitle">{t("props.gatewayConditions")}</div>
      {outgoing.length === 0 ? (
        <p className="bf-var-hint">{t("props.gatewayNoFlows")}</p>
      ) : (
        <div className="bf-gateway-flows">
          {outgoing.map((edge) => (
            <div key={edge.id} className="bf-gateway-flow">
              <div className="bf-gateway-flow-target" title={branchTarget(edge)}>
                {branchTarget(edge)}
              </div>
              <label className="bf-prop-field">
                <span className="bf-prop-label">{t("props.flowLabel")}</span>
                <input
                  value={edge.data?.name ?? ""}
                  placeholder={t("props.flowLabelPlaceholder")}
                  onChange={(e) =>
                    modeler.updateEdgeData(edge.id, { name: e.target.value })
                  }
                />
              </label>
              <FlowConditionBuilder
                value={edge.data?.conditionExpression ?? ""}
                variables={variables}
                onChange={(expression) =>
                  modeler.updateEdgeData(edge.id, {
                    conditionExpression: expression,
                  })
                }
              />
              <label className="bf-prop-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(edge.data?.isDefault)}
                  onChange={(e) => setDefault(edge.id, e.target.checked)}
                />
                <span>{t("props.defaultFlow")}</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
