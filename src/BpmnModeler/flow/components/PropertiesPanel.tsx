import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS, GLOBAL_VARIABLE_TYPES } from "../types/index.ts";
import type {
  BpmnCategory,
  BpmnElementType,
  GlobalVariable,
  GlobalVariableType,
} from "../types/index.ts";
import { COLOR_PRESETS } from "../utils/colors.ts";
import { FONT_FAMILIES } from "../utils/labelStyle.ts";
import { availableVariablesAt } from "../utils/variables.ts";
import type { FlowModeler } from "../hooks/useFlowModeler.ts";
import type { SavedActorForm } from "../../types.ts";
import FlowConditionBuilder from "./FlowConditionBuilder.tsx";
import GatewayConditions from "./GatewayConditions.tsx";
import { PaletteGlyph } from "./Palette.tsx";

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
// The business-metadata fields (owner / priority / … ) mirror the old custom
// properties provider: same field set per element category, same label keys
// (translated in the `bpmn` namespace), persisted as `ecmplus:*` props.

type FieldType = "text" | "number" | "textarea" | "select";
type Option = { value: string; labelKey: string };
type Field = { name: string; labelKey: string; type: FieldType; options?: Option[] };

const LEVELS: Option[] = [
  { value: "low", labelKey: "Low" },
  { value: "medium", labelKey: "Medium" },
  { value: "high", labelKey: "High" },
];
const PRIORITY_LEVELS: Option[] = [...LEVELS, { value: "urgent", labelKey: "Urgent" }];

const OWNER: Field = { name: "owner", labelKey: "Owner", type: "text" };
const PRIORITY: Field = { name: "priority", labelKey: "Priority", type: "select", options: PRIORITY_LEVELS };
const SLA: Field = { name: "sla", labelKey: "SLA (hours)", type: "number" };
const IMPORTANCE: Field = { name: "importance", labelKey: "Importance", type: "select", options: LEVELS };
const NOTES: Field = { name: "notes", labelKey: "Notes", type: "textarea" };

// Camunda execution fields, shown per task type (persisted as ecmplus props,
// so they round-trip through the BPMN XML).
const DESCRIPTION: Field = { name: "description", labelKey: "props.description", type: "textarea" };
const ASSIGNEE: Field = { name: "assignee", labelKey: "props.assignee", type: "text" };
const CAND_USERS: Field = { name: "candidateUsers", labelKey: "props.candidateUsers", type: "text" };
const CAND_GROUPS: Field = { name: "candidateGroups", labelKey: "props.candidateGroups", type: "text" };
const SERVICE_CLASS: Field = { name: "serviceClass", labelKey: "props.serviceClass", type: "text" };
const SCRIPT: Field = { name: "script", labelKey: "props.script", type: "textarea" };

function camundaFieldsFor(type: BpmnElementType): Field[] {
  const out: Field[] = [DESCRIPTION];
  if (type === "userTask") out.push(ASSIGNEE, CAND_USERS, CAND_GROUPS);
  else if (type === "serviceTask") out.push(SERVICE_CLASS);
  else if (type === "scriptTask") out.push(SCRIPT);
  return out;
}

// Which business fields show for each element category / target.
function fieldsFor(target: BpmnCategory | "edge" | "process"): Field[] {
  switch (target) {
    case "process": return [];
    case "task": return [PRIORITY, OWNER, SLA];
    case "event": return [IMPORTANCE, OWNER];
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
};

export default function PropertiesPanel({ modeler, savedActorForms }: PropsControlsProps) {
  const { t } = useTranslation("bpmn");
  const { selectedNode, selectedEdge } = modeler;

  // Render a single business-metadata field bound to an ecmplus prop.
  const renderField = (
    field: Field,
    props: Record<string, string>,
    onChange: (name: string, value: string) => void,
  ) => {
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
        <div className="bf-label-color-row">
          <input
            type="color"
            value={props.labelColor || "#1f2937"}
            onChange={(e) => onChange("labelColor", e.target.value)}
          />
          {props.labelColor && (
            <button type="button" className="bf-label-color-clear" onClick={() => onChange("labelColor", "")}>
              {t("props.reset")}
            </button>
          )}
        </div>
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
        <div className="bf-label-color-row">
          <input
            type="color"
            value={props.lineColor || "#b1b1b7"}
            onChange={(e) => onChange("lineColor", e.target.value)}
          />
          {props.lineColor && (
            <button type="button" className="bf-label-color-clear" onClick={() => onChange("lineColor", "")}>
              {t("props.reset")}
            </button>
          )}
        </div>
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
            defaultValue={selectedNode.id}
            key={selectedNode.id}
            onBlur={(e) => modeler.renameNodeId(selectedNode.id, e.target.value)}
          />
        </label>

        <label className="bf-prop-field">
          <span className="bf-prop-label">{t("props.name")}</span>
          <input
            value={data.name}
            onChange={(e) => modeler.updateNodeData(selectedNode.id, { name: e.target.value })}
          />
        </label>

        {CONDITIONAL_GATEWAYS.has(data.bpmnType) && (
          <GatewayConditions
            modeler={modeler}
            gatewayId={selectedNode.id}
            savedActorForms={savedActorForms}
          />
        )}

        {camundaFieldsFor(data.bpmnType).map((f) => renderField(f, data.props, setProp))}
        {fieldsFor(category).map((f) => renderField(f, data.props, setProp))}

        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.color")}</span>
          <div className="bf-color-swatches">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`bf-swatch${!c.fill && !data.fill ? " bf-swatch-on" : ""}${data.fill === c.fill ? " bf-swatch-on" : ""}`}
                style={{ background: c.fill ?? "transparent", borderColor: c.stroke ?? "#9ca3af" }}
                title={t(`color.${c.key}`)}
                onClick={() => modeler.updateNodeData(selectedNode.id, { fill: c.fill, stroke: c.stroke })}
              />
            ))}
          </div>
        </div>

        {renderLabelStyle(data.props, setProp)}
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

        <label className="bf-prop-field">
          <span className="bf-prop-label">{t("props.name")}</span>
          <input
            value={data.name ?? ""}
            onChange={(e) => modeler.updateEdgeData(selectedEdge.id, { name: e.target.value })}
          />
        </label>

        <div className="bf-prop-field">
          <span className="bf-prop-label">{t("props.condition")}</span>
          <FlowConditionBuilder
            key={selectedEdge.id}
            value={data.conditionExpression ?? ""}
            variables={variables}
            onChange={(expression) =>
              modeler.updateEdgeData(selectedEdge.id, {
                conditionExpression: expression,
              })
            }
          />
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
      </div>
    );
  }

  // ---- Nothing selected → process properties ---------------------------------
  const meta = modeler.processMeta;
  const setProcessProp = (name: string, value: string) => {
    const next = { ...meta.processProps };
    if (value === "") delete next[name];
    else next[name] = value;
    modeler.setProcessMeta({ ...meta, processProps: next });
  };

  // Process-global variables: a unique-by-name list edited inline below.
  const variables = meta.processVariables;
  const setVariables = (next: GlobalVariable[]) =>
    modeler.setProcessMeta({ ...meta, processVariables: next });
  const updateVariable = (index: number, patch: Partial<GlobalVariable>) =>
    setVariables(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const removeVariable = (index: number) =>
    setVariables(variables.filter((_, i) => i !== index));
  const addVariable = () => {
    const taken = new Set(variables.map((v) => v.name.trim()));
    let n = variables.length + 1;
    while (taken.has(`variable_${n}`)) n += 1;
    setVariables([...variables, { name: `variable_${n}`, type: "string", defaultValue: "" }]);
  };
  // How many variables share each (trimmed) name — used to flag duplicates.
  const nameCounts = variables.reduce((acc, v) => {
    const key = v.name.trim();
    if (key) acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return (
    <div className="bf-properties">
      <PropHeader
        icon={<ProcessGlyph />}
        title={t("props.process")}
        description={t("props.desc.process")}
      />
      <label className="bf-prop-field">
        <span className="bf-prop-label">{t("props.name")}</span>
        <input
          value={meta.processName}
          onChange={(e) => modeler.setProcessMeta({ ...meta, processName: e.target.value })}
        />
      </label>
      <div className="bf-var-hint">{t("props.titleHint")}</div>
      <label className="bf-prop-checkbox">
        <input
          type="checkbox"
          checked={meta.isExecutable}
          onChange={(e) => modeler.setProcessMeta({ ...meta, isExecutable: e.target.checked })}
        />
        <span>{t("props.executable")}</span>
      </label>
      {fieldsFor("process").map((f) => renderField(f, meta.processProps, setProcessProp))}

      <div className="bf-prop-field">
        <span className="bf-prop-label">{t("props.textColor")}</span>
        <div className="bf-label-color-row">
          <input
            type="color"
            value={meta.processProps.titleColor || "#1f2937"}
            onChange={(e) => setProcessProp("titleColor", e.target.value)}
          />
          {meta.processProps.titleColor && (
            <button
              type="button"
              className="bf-label-color-clear"
              onClick={() => setProcessProp("titleColor", "")}
            >
              {t("props.reset")}
            </button>
          )}
        </div>
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

      <div className="bf-prop-subtitle">{t("props.variables")}</div>
      <div className="bf-var-hint">{t("props.variablesHint")}</div>
      <div className="bf-var-list">
        {variables.map((v, i) => {
          const name = v.name.trim();
          const duplicate = name !== "" && (nameCounts.get(name) ?? 0) > 1;
          const invalid = name === "" || duplicate;
          return (
            <div key={i} className={`bf-var-row${invalid ? " bf-var-row-invalid" : ""}`}>
              <div className="bf-var-inputs">
                <input
                  className="bf-var-name"
                  value={v.name}
                  placeholder={t("props.varName")}
                  aria-label={t("props.varName")}
                  onChange={(e) => updateVariable(i, { name: e.target.value })}
                />
                <select
                  className="bf-var-type"
                  value={v.type}
                  aria-label={t("props.varType")}
                  onChange={(e) =>
                    updateVariable(i, { type: e.target.value as GlobalVariableType })
                  }
                >
                  {GLOBAL_VARIABLE_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`props.varTypes.${type}`)}</option>
                  ))}
                </select>
                <input
                  className="bf-var-default"
                  value={v.defaultValue ?? ""}
                  placeholder={t("props.varDefault")}
                  aria-label={t("props.varDefault")}
                  onChange={(e) => updateVariable(i, { defaultValue: e.target.value })}
                />
                <button
                  type="button"
                  className="bf-var-remove"
                  title={t("props.removeVariable")}
                  aria-label={t("props.removeVariable")}
                  onClick={() => removeVariable(i)}
                >
                  ×
                </button>
              </div>
              {invalid && (
                <span className="bf-var-error">
                  {duplicate ? t("props.varDuplicate") : t("props.varEmpty")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="bf-var-add" onClick={addVariable}>
        + {t("props.addVariable")}
      </button>
    </div>
  );
}
