import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ELEMENT_SPECS, GLOBAL_VARIABLE_TYPES } from "../types/index.ts";
import type {
  BpmnCategory,
  BpmnElementType,
  GlobalVariable,
  GlobalVariableType,
  VariableApiSource,
  VariableValueSource,
} from "../types/index.ts";
import { useApiCheckStore } from "../store/apiCheckStore.ts";
import { COLOR_PRESETS } from "../utils/colors.ts";
import { FONT_FAMILIES } from "../utils/labelStyle.ts";
import { availableVariablesAt, fetchApiVariableValue } from "../utils/variables.ts";
import type { FlowModeler } from "../hooks/useFlowModeler.ts";
import type { SavedActorForm } from "../../types.ts";
import AllowedActors from "./AllowedActors.tsx";
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
// The business-metadata fields (owner / importance / … ) mirror the old custom
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

const OWNER: Field = { name: "owner", labelKey: "Owner", type: "text" };
const IMPORTANCE: Field = { name: "importance", labelKey: "Importance", type: "select", options: LEVELS };
const NOTES: Field = { name: "notes", labelKey: "Notes", type: "textarea" };

// Camunda execution fields, shown per task type (persisted as ecmplus props,
// so they round-trip through the BPMN XML).
const DESCRIPTION: Field = { name: "description", labelKey: "props.description", type: "textarea" };
const SERVICE_CLASS: Field = { name: "serviceClass", labelKey: "props.serviceClass", type: "text" };
const SCRIPT: Field = { name: "script", labelKey: "props.script", type: "textarea" };

function camundaFieldsFor(type: BpmnElementType): Field[] {
  const out: Field[] = [DESCRIPTION];
  if (type === "serviceTask") out.push(SERVICE_CLASS);
  else if (type === "scriptTask") out.push(SCRIPT);
  return out;
}

// Which business fields show for each element category / target.
function fieldsFor(target: BpmnCategory | "edge" | "process"): Field[] {
  switch (target) {
    case "process": return [];
    case "task": return [];
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
  // Open the form designer for the process's start event (its optional initial
  // form). Undefined when there's no start event to target.
  onEditInitialForm?: () => void;
};

export default function PropertiesPanel({
  modeler,
  savedActorForms,
  onEditInitialForm,
}: PropsControlsProps) {
  const { t } = useTranslation("bpmn");
  const { selectedNode, selectedEdge } = modeler;

  // Live "test connection" outcome for API-sourced variables: the status (shared
  // with validation, keyed by variable name) lives in the store; the human
  // message shown under each row is kept locally here.
  const apiStatus = useApiCheckStore((s) => s.status);
  const setApiStatus = useApiCheckStore((s) => s.setStatus);
  const clearApiStatus = useApiCheckStore((s) => s.clear);
  const [apiMessage, setApiMessage] = useState<Record<string, string>>({});

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

  // Process-global variables: a unique-by-name list edited inline below.
  const variables = meta.processVariables;
  const setVariables = (next: GlobalVariable[]) =>
    modeler.setProcessMeta({ ...meta, processVariables: next });
  const updateVariable = (index: number, patch: Partial<GlobalVariable>) =>
    setVariables(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  const removeVariable = (index: number) => {
    clearApiStatus(variables[index].name.trim());
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Patch a variable's API config and reset its connection status: any edit to
  // the endpoint invalidates a prior successful test, so the process is invalid
  // again until the user re-tests.
  const updateApi = (index: number, patch: Partial<VariableApiSource>) => {
    const v = variables[index];
    clearApiStatus(v.name.trim());
    setApiMessage((prev) => {
      const next = { ...prev };
      delete next[v.name.trim()];
      return next;
    });
    updateVariable(index, {
      api: { url: v.api?.url ?? "", path: v.api?.path ?? "", ...v.api, ...patch },
    });
  };

  // Rename a variable, carrying over (resetting) its API check status to the new
  // name so a stale "ok" can't leak onto a different variable.
  const renameVariable = (index: number, name: string) => {
    clearApiStatus(variables[index].name.trim());
    updateVariable(index, { name });
  };

  // Test an API variable's endpoint: fetch and extract its value, then mark it
  // ok (with a data preview) or error (no data / failed request).
  const testApi = async (v: GlobalVariable) => {
    const name = v.name.trim();
    if (!v.api?.url?.trim()) return;
    setApiStatus(name, "checking");
    setApiMessage((prev) => ({ ...prev, [name]: t("props.apiTesting") }));
    try {
      const value = await fetchApiVariableValue(v.api, v.type);
      if (!value) {
        setApiStatus(name, "error");
        setApiMessage((prev) => ({ ...prev, [name]: t("props.apiNoData") }));
        return;
      }
      setApiStatus(name, "ok");
      setApiMessage((prev) => ({ ...prev, [name]: t("props.apiOk", { data: value }) }));
    } catch {
      setApiStatus(name, "error");
      setApiMessage((prev) => ({ ...prev, [name]: t("props.apiTestError") }));
    }
  };
  const addVariable = () => {
    const taken = new Set(variables.map((v) => v.name.trim()));
    let n = variables.length + 1;
    while (taken.has(`variable_${n}`)) n += 1;
    setVariables([...variables, { name: `variable_${n}`, type: "string", source: "manual" }]);
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

      <AllowedActors
        value={meta.allowedActors ?? []}
        availableVariables={variables
          .filter((v) => v.name.trim())
          .map((v) => ({ name: v.name.trim(), type: v.type, origin: "global" }))}
        onChange={(next) => modeler.setProcessMeta({ ...meta, allowedActors: next })}
      />

      <div className="bf-prop-subtitle">{t("props.initialForm")}</div>
      <div className="bf-var-hint">{t("props.initialFormHint")}</div>
      {!hasInitialForm && (
        <div className="bf-actor-empty">{t("props.noInitialForm")}</div>
      )}
      <div className="bf-initial-form-actions">
        <button
          type="button"
          className="bf-var-add"
          disabled={!onEditInitialForm}
          onClick={onEditInitialForm}
        >
          {hasInitialForm ? t("props.updateInitialForm") : t("props.addInitialForm")}
        </button>
      </div>

      <div className="bf-prop-subtitle">{t("props.variables")}</div>
      <div className="bf-var-hint">{t("props.variablesHint")}</div>
      <div className="bf-var-list">
        {variables.map((v, i) => {
          const name = v.name.trim();
          const source = v.source ?? "manual";
          const duplicate = name !== "" && (nameCounts.get(name) ?? 0) > 1;
          // A "manual" variable must carry a design-time value, or the process
          // is invalid.
          const manualEmpty = source === "manual" && !v.value?.trim();
          const invalid = name === "" || duplicate || manualEmpty;
          return (
            <div key={i} className={`bf-var-row${invalid ? " bf-var-row-invalid" : ""}`}>
              <div className="bf-var-inputs">
                <input
                  className="bf-var-name"
                  value={v.name}
                  placeholder={t("props.varName")}
                  aria-label={t("props.varName")}
                  onChange={(e) => renameVariable(i, e.target.value)}
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
                <select
                  className="bf-var-source"
                  value={v.source ?? "manual"}
                  aria-label={t("props.varSource")}
                  onChange={(e) =>
                    updateVariable(i, { source: e.target.value as VariableValueSource })
                  }
                >
                  <option value="manual">{t("props.varSourceManual")}</option>
                  <option value="api">{t("props.varSourceApi")}</option>
                  <option value="actor">{t("props.varSourceActor")}</option>
                </select>
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
              {source === "manual" && (
                <input
                  className="bf-var-value"
                  value={v.value ?? ""}
                  placeholder={t("props.varValue")}
                  aria-label={t("props.varValue")}
                  onChange={(e) => updateVariable(i, { value: e.target.value })}
                />
              )}
              {source === "actor" && (
                <input
                  className="bf-var-value"
                  value={v.value ?? ""}
                  placeholder={t("props.varActorDefault")}
                  aria-label={t("props.varActorDefault")}
                  onChange={(e) => updateVariable(i, { value: e.target.value })}
                />
              )}
              {source === "api" && (() => {
                const status = apiStatus[name] ?? "untested";
                const message = apiMessage[name];
                return (
                  <div className="bf-var-api">
                    <input
                      className="bf-var-api-url"
                      value={v.api?.url ?? ""}
                      placeholder={t("props.varApiUrl")}
                      aria-label={t("props.varApiUrl")}
                      onChange={(e) => updateApi(i, { url: e.target.value })}
                    />
                    <input
                      className="bf-var-api-path"
                      value={v.api?.path ?? ""}
                      placeholder={t("props.varApiPath")}
                      aria-label={t("props.varApiPath")}
                      onChange={(e) => updateApi(i, { path: e.target.value })}
                    />
                    {v.type === "array" && (
                      <input
                        className="bf-var-api-key"
                        value={v.api?.key ?? ""}
                        placeholder={t("props.varApiKey")}
                        aria-label={t("props.varApiKey")}
                        onChange={(e) => updateApi(i, { key: e.target.value })}
                      />
                    )}
                    <button
                      type="button"
                      className="bf-var-api-test"
                      disabled={status === "checking" || !v.api?.url?.trim()}
                      onClick={() => void testApi(v)}
                    >
                      {status === "checking" ? t("props.apiTesting") : t("props.apiTest")}
                    </button>
                    {message && (
                      <span className={`bf-var-api-result bf-var-api-${status}`}>{message}</span>
                    )}
                  </div>
                );
              })()}
              {invalid && (
                <span className="bf-var-error">
                  {name === ""
                    ? t("props.varEmpty")
                    : duplicate
                    ? t("props.varDuplicate")
                    : t("props.varValueRequired")}
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
