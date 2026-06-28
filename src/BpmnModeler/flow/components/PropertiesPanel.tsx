import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS } from "../types/index.ts";
import type {
  BpmnCategory,
  BpmnElementType,
} from "../types/index.ts";
import { FONT_FAMILIES } from "../utils/labelStyle.ts";
import { availableVariablesAt, humanizeExpression, segmentExpression } from "../utils/variables.ts";
import { AR_SUFFIX } from "../utils/localizedText.ts";
import type { FlowModeler } from "../hooks/useFlowModeler.ts";
import type { SavedActorForm } from "../../types.ts";
import type { FormSchema } from "@FormBuilder/types.ts";
import { resolveText } from "@FormBuilder";
import ColorPicker from "@components/ColorPicker";
import AllowedActors from "./AllowedActors.tsx";
import ConditionModal from "./ConditionModal.tsx";
import GatewayConditions from "./GatewayConditions.tsx";
import { PaletteGlyph } from "./Palette.tsx";
import HttpConnectorConfig from "./HttpConnectorConfig/index.ts";

// Icon for the sequence-flow header: an arrow between two nodes.
function FlowGlyph(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="4" cy="10" r="2.2" />
      <path d="M6.5 10h7M11 7l3 3-3 3" />
    </svg>
  );
}

// Icon for the process header: a small flow diagram.
function ProcessGlyph(): React.ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="7" width="5" height="6" rx="1" />
      <rect x="12.5" y="7" width="5" height="6" rx="1" />
      <path d="M7.5 10h5" />
    </svg>
  );
}

// Panel header: a type icon, the element label, and a one-line description of
// what the selected element is.
function PropHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}): React.ReactNode {
  return (
    <div className="bf-prop-header">
      <div className="bf-prop-title-row">
        <span className="bf-prop-icon">{icon}</span>
        <span className="bf-prop-title">{title}</span>
      </div>
      {description && <p className="bf-prop-desc">{description}</p>}
    </div>
  );
}

// Data-based gateways whose outgoing flows carry conditions — their branch
// logic is editable straight from the gateway's properties.
const CONDITIONAL_GATEWAYS = new Set<BpmnElementType>([
  "exclusiveGateway",
  "inclusiveGateway",
]);

// The React properties panel — the replacement for bpmn-js-properties-panel,
// the color picker, and the condition-expression editor. It edits whatever is
// selected (a node, an edge, or — when nothing is selected — the process), and
// writes straight into the graph model via the modeler's update callbacks.
//
// The business-metadata fields (owner / importance / … ) mirror the old custom
// properties provider: same field set per element category, same label keys
// (translated in the `bpmn` namespace), persisted as `ecmplus:*` props.

type FieldType = "text" | "number" | "textarea" | "select";
type Option = { value: string; labelKey: string };
// `localized` marks a free-text field that's authored in both languages: the
// default (English) value in `props[name]` and the Arabic variant in
// `props[name + AR_SUFFIX]`.
type Field = { name: string; labelKey: string; type: FieldType; options?: Option[]; localized?: boolean };

const OWNER: Field = { name: "owner", labelKey: "Owner", type: "text" };
const NOTES: Field = { name: "notes", labelKey: "Notes", type: "textarea", localized: true };

// Camunda execution fields, shown per task type (persisted as ecmplus props,
// so they round-trip through the BPMN XML).
const SERVICE_CLASS: Field = { name: "serviceClass", labelKey: "props.serviceClass", type: "text" };
const SCRIPT: Field = { name: "script", labelKey: "props.script", type: "textarea" };

function camundaFieldsFor(type: BpmnElementType): Field[] {
  const out: Field[] = [];
  if (type === "serviceTask") out.push(SERVICE_CLASS);
  else if (type === "scriptTask") out.push(SCRIPT);
  return out;
}

// Which business fields show for each element category / target.
function fieldsFor(target: BpmnCategory | "edge" | "process"): Field[] {
  switch (target) {
    case "process": return [];
    case "task": return [];
    case "event": return [];
    case "gateway": return [NOTES];
    case "edge": return [OWNER, NOTES];
  }
}

// Connector line patterns offered for a sequence flow.
const LINE_STYLES: Option[] = [
  { value: "", labelKey: "props.lineSolid" },
  { value: "dashed", labelKey: "props.lineDashed" },
  { value: "dotted", labelKey: "props.lineDotted" },
];

type PropsControlsProps = {
  modeler: FlowModeler;
  savedActorForms: Record<string, SavedActorForm>;
  // Open the form designer for the process's start event (its optional initial
  // form). Undefined when there's no start event to target.
  onEditInitialForm?: () => void;
  // Open the form designer for a specific task node.
  onEditTaskForm?: (nodeId: string, label: string) => void;
  // Open the actor selector for a specific task node.
  onSelectActor?: (nodeId: string) => void;
};

export default function PropertiesPanel({
  modeler,
  savedActorForms,
  onEditInitialForm,
  onEditTaskForm,
  onSelectActor,
}: PropsControlsProps) {
  const { t, i18n } = useTranslation("bpmn");
  const { t: tForm } = useTranslation("form");
  const { selectedNode, selectedEdge } = modeler;

  // Condition-edit modal for a selected edge (true = open).
  const [conditionModalOpen, setConditionModalOpen] = useState(false);

  // A translatable free-text field: the default (English) value plus its Arabic
  // variant, shown as two stacked, language-tagged controls. The default is
  // persisted as today; the Arabic variant lives in the parallel `<name>Ar`
  // prop, so both round-trip through the BPMN XML.
  const renderBilingual = (
    key: string,
    label: string,
    enValue: string,
    onEn: (value: string) => void,
    arValue: string,
    onAr: (value: string) => void,
    multiline = false,
  ) => (
    <div key={key} className="bf-prop-field bf-prop-bilingual">
      <span className="bf-prop-label">{label}</span>
      <div className="bf-prop-lang">
        <span className="bf-prop-lang-tag">{t("props.langEn")}</span>
        {multiline ? (
          <textarea rows={2} value={enValue} onChange={(e) => onEn(e.target.value)} />
        ) : (
          <input value={enValue} onChange={(e) => onEn(e.target.value)} />
        )}
      </div>
      <div className="bf-prop-lang" dir="rtl">
        <span className="bf-prop-lang-tag">{t("props.langAr")}</span>
        {multiline ? (
          <textarea rows={2} value={arValue} onChange={(e) => onAr(e.target.value)} />
        ) : (
          <input value={arValue} onChange={(e) => onAr(e.target.value)} />
        )}
      </div>
    </div>
  );

  // Render a single business-metadata field bound to an ecmplus prop.
  const renderField = (
    field: Field,
    props: Record<string, string>,
    onChange: (name: string, value: string) => void,
  ) => {
    if (field.localized) {
      return renderBilingual(
        field.name,
        t(field.labelKey),
        props[field.name] ?? "",
        (value) => onChange(field.name, value),
        props[`${field.name}${AR_SUFFIX}`] ?? "",
        (value) => onChange(`${field.name}${AR_SUFFIX}`, value),
        field.type === "textarea",
      );
    }
    const value = props[field.name] ?? "";
    const id = `bf-field-${field.name}`;
    return (
      <label key={field.name} className="bf-prop-field" htmlFor={id}>
        <span className="bf-prop-label">{t(field.labelKey)}</span>
        {field.type === "select" ? (
          <select id={id} value={value} onChange={(e) => onChange(field.name, e.target.value)}>
            <option value="">{t("<none>")}</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
        ) : field.type === "textarea" ? (
          <textarea id={id} rows={2} value={value} onChange={(e) => onChange(field.name, e.target.value)} />
        ) : (
          <input
            id={id}
            type={field.type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        )}
      </label>
    );
  };

  // The "Label" section: text colour, size, weight, style and font. Shared by
  // the node and edge branches; values persist as `ecmplus:label*` props.
  const renderLabelStyle = (
    props: Record<string, string>,
    onChange: (name: string, value: string) => void,
  ) => (
    <>
      <div className="bf-prop-subtitle">{t("props.label")}</div>

      <div className="bf-prop-field">
        <span className="bf-prop-label">{t("props.textColor")}</span>
        <ColorPicker
          value={props.labelColor || undefined}
          defaultColor="#1f2937"
          onChange={(v) => onChange("labelColor", v ?? "")}
        />
      </div>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.fontSize")}</span>
        <input
          type="number"
          min={6}
          max={72}
          value={props.labelFontSize ?? ""}
          placeholder="12"
          onChange={(e) => onChange("labelFontSize", e.target.value)}
        />
      </label>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.fontFamily")}</span>
        <select
          value={props.labelFontFamily ?? ""}
          onChange={(e) => onChange("labelFontFamily", e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <div className="bf-prop-checkbox-row">
        <label className="bf-prop-checkbox">
          <input
            type="checkbox"
            checked={props.labelBold === "true"}
            onChange={(e) => onChange("labelBold", e.target.checked ? "true" : "")}
          />
          <span>{t("props.bold")}</span>
        </label>
        <label className="bf-prop-checkbox">
          <input
            type="checkbox"
            checked={props.labelItalic === "true"}
            onChange={(e) => onChange("labelItalic", e.target.checked ? "true" : "")}
          />
          <span>{t("props.italic")}</span>
        </label>
      </div>
    </>
  );

  // The "Connector" section: line pattern, colour and width for a sequence flow.
  const renderConnectorStyle = (
    props: Record<string, string>,
    onChange: (name: string, value: string) => void,
  ) => (
    <>
      <div className="bf-prop-subtitle">{t("props.connector")}</div>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.lineStyle")}</span>
        <select value={props.lineStyle ?? ""} onChange={(e) => onChange("lineStyle", e.target.value)}>
          {LINE_STYLES.map((s) => (
            <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
          ))}
        </select>
      </label>

      <div className="bf-prop-field">
        <span className="bf-prop-label">{t("props.lineColor")}</span>
        <ColorPicker
          value={props.lineColor || undefined}
          defaultColor="#b1b1b7"
          onChange={(v) => onChange("lineColor", v ?? "")}
        />
      </div>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.lineWidth")}</span>
        <input
          type="number"
          min={1}
          max={8}
          step={0.5}
          value={props.lineWidth ?? ""}
          placeholder="1.5"
          onChange={(e) => onChange("lineWidth", e.target.value)}
        />
      </label>
    </>
  );

  // ---- Node selected ---------------------------------------------------------
  if (selectedNode) {
    const data = selectedNode.data;
    const category = ELEMENT_SPECS[data.bpmnType].category;
    const setProp = (name: string, value: string) => {
      const next = { ...data.props };
      if (value === "") delete next[name];
      else next[name] = value;
      modeler.updateNodeData(selectedNode.id, { props: next });
    };

    return (
      <div className="bf-properties">
        <PropHeader
          icon={<PaletteGlyph type={data.bpmnType} />}
          title={t(ELEMENT_SPECS[data.bpmnType].labelKey)}
          description={t(`props.desc.${data.bpmnType}`)}
        />

        <label className="bf-prop-field">
          <span className="bf-prop-label">{t("props.id")}</span>
          <input
            value={selectedNode.id}
            disabled
            readOnly
          />
        </label>

        {renderBilingual(
          "name",
          t("props.name"),
          data.name,
          (value) => modeler.updateNodeData(selectedNode.id, { name: value }),
          data.props.nameAr ?? "",
          (value) => setProp(`name${AR_SUFFIX}`, value),
        )}

        {CONDITIONAL_GATEWAYS.has(data.bpmnType) && (
          <GatewayConditions
            modeler={modeler}
            gatewayId={selectedNode.id}
            savedActorForms={savedActorForms}
          />
        )}

        {data.bpmnType === "httpConnectorTask" && (
          <HttpConnectorConfig
            props={data.props}
            setProp={setProp}
            modeler={modeler}
            savedActorForms={savedActorForms}
          />
        )}

        {camundaFieldsFor(data.bpmnType).map((f) => renderField(f, data.props, setProp))}
        {fieldsFor(category).map((f) => renderField(f, data.props, setProp))}

        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.backgroundColor")}</span>
          <ColorPicker
            value={data.fill || undefined}
            defaultColor="#ffffff"
            onChange={(v) => modeler.updateNodeData(selectedNode.id, { fill: v, stroke: undefined })}
          />
        </div>

        {renderLabelStyle(data.props, setProp)}

        {ELEMENT_SPECS[data.bpmnType].actor && data.bpmnType !== "startEvent" && (() => {
          const p = data.props;
          const actorName = p.actorName || p.actorEmployeeName || p.actorPrimaryName || p.actorValue || null;
          const actorTypeKey = (() => {
            switch (p.actorKind) {
              case "orgtype":   return "kind.orgtype";
              case "orgunit":   return "kind.orgunit";
              case "group":     return "kind.group";
              case "employee":  return "kind.employee";
              case "role":      return p.actorRole === "manager" ? "roleOption.manager" : "roleOption.employee";
              case "custom":    return "kind.custom";
              default:          return null;
            }
          })();
          return (
            <>
              <div className="bf-prop-subtitle">{t("props.actor")}</div>
              <div className="bf-var-hint">{t("props.actorHint")}</div>
              {actorName ? (
                <div className="bf-actor-assigned">
                  <span className="bf-actor-assigned-name">{actorName}</span>
                  {actorTypeKey && <span className="bf-actor-assigned-type">{t(actorTypeKey)}</span>}
                </div>
              ) : (
                <div className="bf-actor-empty">{t("props.noActor")}</div>
              )}
              <button
                type="button"
                className="bf-var-add"
                disabled={!onSelectActor}
                onClick={() => onSelectActor?.(selectedNode.id)}
              >
                + {actorName ? t("props.changeActor") : t("props.selectActor")}
              </button>
            </>
          );
        })()}

        {ELEMENT_SPECS[data.bpmnType].actor && data.bpmnType !== "startEvent" && (() => {
          const hasForm = Boolean(savedActorForms[selectedNode.id]);
          const label = data.name || selectedNode.id;
          const schema = savedActorForms[selectedNode.id]?.schema as unknown as FormSchema | undefined;
          const fields = (schema?.pages ?? [])
            .flatMap((p) => p.elements)
            .filter((f) => f.type !== "group" && f.type !== "divider");
          return (
            <>
              <div className="bf-prop-subtitle">{t("props.taskForm")}</div>
              <div className="bf-var-hint">{t("props.taskFormHint")}</div>
              {!hasForm && (
                <div className="bf-actor-empty">{t("props.noTaskForm")}</div>
              )}
              {hasForm && fields.length > 0 && (
                <div className="bf-form-fields">
                  {fields.map((field, i) => {
                    const fieldLabel = resolveText(field.title, i18n.language) || field.name;
                    const typeLabel = tForm(`designer.types.${field.type}`, { defaultValue: field.type });
                    return (
                      <div key={field.id ?? field.name ?? String(i)} className="bf-form-field-row">
                        <span className="bf-form-field-label">{fieldLabel}</span>
                        {field.isRequired && <span className="bf-form-field-req" aria-hidden>*</span>}
                        <span className="bf-form-field-type">{typeLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className="bf-var-add"
                disabled={!onEditTaskForm}
                onClick={() => onEditTaskForm?.(selectedNode.id, label)}
              >
                + {hasForm ? t("props.updateTaskForm") : t("props.addTaskForm")}
              </button>
            </>
          );
        })()}
      </div>
    );
  }

  // ---- Edge selected ---------------------------------------------------------
  if (selectedEdge) {
    const data = selectedEdge.data ?? {};
    const setProp = (name: string, value: string) => {
      const next = { ...(data.props ?? {}) };
      if (value === "") delete next[name];
      else next[name] = value;
      modeler.updateEdgeData(selectedEdge.id, { props: next });
    };

    // Variables in scope for this flow's condition: the process globals plus
    // everything produced by tasks upstream of the flow's source.
    const variables = availableVariablesAt({
      nodes: modeler.nodes,
      edges: modeler.edges,
      savedActorForms,
      globals: modeler.processMeta.processVariables,
      nodeId: selectedEdge.source,
    });

    return (
      <div className="bf-properties">
        <PropHeader
          icon={<FlowGlyph />}
          title={t("props.sequenceFlow")}
          description={t("props.desc.sequenceFlow")}
        />

        {renderBilingual(
          "name",
          t("props.name"),
          data.name ?? "",
          (value) => modeler.updateEdgeData(selectedEdge.id, { name: value }),
          data.props?.nameAr ?? "",
          (value) => setProp(`name${AR_SUFFIX}`, value),
        )}

        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.condition")}</span>
          <div
            className="bf-cond-summary"
            title={humanizeExpression(data.conditionExpression ?? "", variables)}
          >
            {data.conditionExpression
              ? segmentExpression(data.conditionExpression, variables).map((seg, i) =>
                  seg.kind === "var"
                    ? <span key={i} className="bf-cond-var-chip">{seg.display}</span>
                    : <span key={i}>{seg.text}</span>
                )
              : t("props.noCondition")}
          </div>
          <button
            type="button"
            className="bf-cond-edit-btn"
            onClick={() => setConditionModalOpen(true)}
          >
            {t("props.editConditions")}
          </button>
        </div>

        <label className="bf-prop-checkbox">
          <input
            type="checkbox"
            checked={Boolean(data.isDefault)}
            onChange={(e) => modeler.updateEdgeData(selectedEdge.id, { isDefault: e.target.checked })}
          />
          <span>{t("props.defaultFlow")}</span>
        </label>

        {fieldsFor("edge").map((f) => renderField(f, data.props ?? {}, setProp))}

        {renderConnectorStyle(data.props ?? {}, setProp)}
        {renderLabelStyle(data.props ?? {}, setProp)}

        {conditionModalOpen && (
          <ConditionModal
            title={data.name ?? data.props?.[`name${AR_SUFFIX}`] ?? ""}
            value={data.conditionExpression ?? ""}
            variables={variables}
            onApply={(expression) => {
              modeler.updateEdgeData(selectedEdge.id, {
                conditionExpression: expression,
              });
              setConditionModalOpen(false);
            }}
            onClose={() => setConditionModalOpen(false)}
          />
        )}
      </div>
    );
  }

  // ---- Nothing selected → process properties ---------------------------------
  const meta = modeler.processMeta;

  // The start event carries the process's optional initial form (shown to
  // whoever starts the process). Read whether one is already attached.
  const startNode = modeler.nodes.find((n) => n.data.bpmnType === "startEvent");
  const hasInitialForm = startNode ? Boolean(savedActorForms[startNode.id]) : false;

  const setProcessProp = (name: string, value: string) => {
    const next = { ...meta.processProps };
    if (value === "") delete next[name];
    else next[name] = value;
    modeler.setProcessMeta({ ...meta, processProps: next });
  };

  const variables = meta.processVariables;

  return (
    <div className="bf-properties">
      <PropHeader
        icon={<ProcessGlyph />}
        title={t("props.process")}
        description={t("props.desc.process")}
      />
      {renderBilingual(
        "name",
        t("props.name"),
        meta.processName,
        (value) => modeler.setProcessMeta({ ...meta, processName: value }),
        meta.processProps.nameAr ?? "",
        (value) => setProcessProp(`name${AR_SUFFIX}`, value),
      )}
      <div className="bf-var-hint">{t("props.titleHint")}</div>
      {fieldsFor("process").map((f) => renderField(f, meta.processProps, setProcessProp))}

      <div className="bf-prop-field">
        <span className="bf-prop-label">{t("props.textColor")}</span>
        <ColorPicker
          value={meta.processProps.titleColor || undefined}
          defaultColor="#1f2937"
          onChange={(v) => setProcessProp("titleColor", v ?? "")}
        />
      </div>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.fontSize")}</span>
        <input
          type="number"
          min={8}
          max={96}
          value={meta.processProps.titleFontSize ?? ""}
          placeholder="20"
          onChange={(e) => setProcessProp("titleFontSize", e.target.value)}
        />
      </label>

      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.fontFamily")}</span>
        <select
          value={meta.processProps.titleFontFamily ?? ""}
          onChange={(e) => setProcessProp("titleFontFamily", e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      <AllowedActors
        value={meta.allowedActors ?? []}
        availableVariables={variables
          .filter((v) => v.name.trim())
          .map((v) => ({
            name: v.name.trim(),
            ref: v.name.trim(),
            type: v.type,
            origin: "global" as const,
          }))}
        onChange={(next) => modeler.setProcessMeta({ ...meta, allowedActors: next })}
      />

      <div className="bf-prop-subtitle">{t("props.initialForm")}</div>
      <div className="bf-var-hint">{t("props.initialFormHint")}</div>
      {!hasInitialForm && (
        <div className="bf-actor-empty">{t("props.noInitialForm")}</div>
      )}
      {hasInitialForm && startNode && (() => {
        const schema = savedActorForms[startNode.id]?.schema as unknown as FormSchema;
        const fields = (schema?.pages ?? [])
          .flatMap((p) => p.elements)
          .filter((f) => f.type !== "group" && f.type !== "divider");
        if (!fields.length) return null;
        return (
          <div className="bf-form-fields">
            {fields.map((field, i) => {
              const label = resolveText(field.title, i18n.language) || field.name;
              const typeLabel = tForm(`designer.types.${field.type}`, { defaultValue: field.type });
              return (
                <div key={field.id ?? field.name ?? String(i)} className="bf-form-field-row">
                  <span className="bf-form-field-label">{label}</span>
                  {field.isRequired && <span className="bf-form-field-req" aria-hidden>*</span>}
                  <span className="bf-form-field-type">{typeLabel}</span>
                </div>
              );
            })}
          </div>
        );
      })()}
      <button
        type="button"
        className="bf-var-add"
        disabled={!onEditInitialForm}
        onClick={onEditInitialForm}
      >
        + {hasInitialForm ? t("props.updateInitialForm") : t("props.addInitialForm")}
      </button>

    </div>
  );
}
