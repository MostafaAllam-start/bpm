import { useEffect, useRef, useState, type ChangeEvent } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from "bpmn-js-properties-panel";
import TokenSimulationModule from "bpmn-js-token-simulation";

// bpmn-js ships its own stylesheets. The diagram-js + bpmn-js CSS provide the
// canvas / palette / context-pad styling, and the bpmn-font CSS renders the
// shape icons (tasks, gateways, events, ...).
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
// Properties panel (edit a selected element's name/id/...) and token simulation
// (animate tokens through the flow) — both are bpmn.io add-ons.
import "@bpmn-io/properties-panel/dist/assets/properties-panel.css";
import "bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css";

import "./BpmnModeler.css";

// A minimal but valid BPMN 2.0 diagram to start from. It contains a single
// start event so the canvas isn't empty — drag from its context pad (or the
// palette on the left) to model the rest of the process.
const INITIAL_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const ACTOR_TYPES = ["orgunit", "employee", "group", "custom"] as const;

type ActorType = (typeof ACTOR_TYPES)[number];

const ACTOR_COLLECTIONS: Record<ActorType, string[]> = {
  orgunit: ["HR", "Finance", "IT", "Operations"],
  employee: ["Alice", "Bob", "Charlie", "Dana"],
  group: ["Admins", "Managers", "Support", "Developers"],
  custom: ["Custom A", "Custom B", "Custom C"],
};

const ACTOR_ELEMENT_TYPES = new Set([
  "bpmn:Participant",
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ScriptTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
]);

function isActorElement(element: any): boolean {
  const type = element?.businessObject?.$type ?? element?.type;
  return ACTOR_ELEMENT_TYPES.has(type);
}

// Pull a human-readable message out of an unknown thrown value.
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Trigger a browser download for a string of text (BPMN XML or SVG markup).
function downloadFile(name: string, data: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type BpmnEditorProps = {
  savedActorForms?: Record<string, { actorLabel: string; schema: object }>;
  onOpenActorForm?: (actorId: string, actorLabel: string) => void;
};

const BPMN_TYPE_LABELS: Record<string, string> = {
  "bpmn:Participant": "Participant",
  "bpmn:Task": "Task",
  "bpmn:UserTask": "User Task",
  "bpmn:ServiceTask": "Service Task",
  "bpmn:ManualTask": "Manual Task",
  "bpmn:ScriptTask": "Script Task",
  "bpmn:SendTask": "Send Task",
  "bpmn:ReceiveTask": "Receive Task",
};

function getActorLabel(element: any): string {
  const businessObject = element?.businessObject;
  const type = businessObject?.$type || element?.type;
  const typeLabel = type
    ? BPMN_TYPE_LABELS[type] || type.replace(/^bpmn:/, "")
    : undefined;

  return (
    businessObject?.actorSelection ||
    businessObject?.name ||
    businessObject?.actorType ||
    typeLabel ||
    businessObject?.id ||
    element?.id ||
    "Actor"
  );
}

export default function BpmnEditor({
  savedActorForms,
  onOpenActorForm,
}: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    actorId: string;
    actorLabel: string;
  } | null>(null);
  const [actorSelector, setActorSelector] = useState<{
    actorId: string;
    type: ActorType;
    selection: string;
  } | null>(null);

  const hidePoweredBy = (): void => {
    const list = document.querySelectorAll(".bjs-powered-by, .fjs-powered-by-link");
    list.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.display = "none";
      }
    });
  };

  useEffect(() => {
    const container = containerRef.current!;

    // Create the modeler bound to our container element.
    //  - propertiesPanel: renders the editable element-properties panel into the
    //    sidebar element on the right.
    //  - additionalModules: the properties panel provider plus token simulation
    //    (adds a "play" toggle to animate tokens through the process).
    const modeler = new BpmnModeler({
      container,
      propertiesPanel: { parent: propertiesRef.current! },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        TokenSimulationModule,
      ],
    });
    modelerRef.current = modeler;

    // React StrictMode mounts effects twice in development (mount → cleanup →
    // mount). `importXML` is async, so without this guard the first run's
    // import resolves *after* its modeler was destroyed and renders into a torn
    // down canvas — bpmn-js then throws "Cannot read properties of undefined
    // (reading 'root-0')". Track whether this run is still the live one.
    let active = true;
    let fitted = false;

    // Load the starting diagram. `imported` resolves to whether it succeeded so
    // later steps can bail out cleanly on a parse error.
    const imported = modeler
      .importXML(INITIAL_DIAGRAM)
      .then(() => true)
      .catch((err: unknown) => {
        if (active) setError(messageOf(err));
        return false;
      });

    imported.then((ok) => {
      if (active && ok) {
        hidePoweredBy();
      }
    });

    const eventBus = modeler.get<any>("eventBus");
    const elementRegistry = modeler.get<any>("elementRegistry");

    const handleElementContextMenu = (event: any) => {
      const element = event.element;
      if (!isActorElement(element)) return;

      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();

      const actorId = element.businessObject?.id || element.id;
      const actorLabel = getActorLabel(element);
      setContextMenu({
        x: event.originalEvent.clientX,
        y: event.originalEvent.clientY,
        actorId,
        actorLabel,
      });
    };

    eventBus.on("element.contextmenu", handleElementContextMenu);

    const findElementAtPoint = (event: MouseEvent) => {
      const target = document.elementFromPoint(
        event.clientX,
        event.clientY,
      ) as Element | null;
      const shape = target?.closest("[data-element-id]") as Element | null;
      const elementId = shape?.getAttribute("data-element-id") || undefined;
      return elementId ? elementRegistry.get(elementId) : null;
    };

    const handleNativeContextMenu = (event: MouseEvent) => {
      const element = findElementAtPoint(event);
      if (!element || !isActorElement(element)) {
        setContextMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const actorId = element.businessObject?.id || element.id;
      const actorLabel = getActorLabel(element);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        actorId,
        actorLabel,
      });
    };

    const observer = new ResizeObserver(() => {
      imported.then((ok) => {
        if (!active || !ok) return;
        const canvas = modeler.get<Canvas>("canvas");
        canvas.resized();
        if (!fitted) {
          canvas.zoom("fit-viewport");
          fitted = true;
        }
      });
    });
    observer.observe(container);

    container.addEventListener("contextmenu", handleNativeContextMenu, {
      capture: true,
    });

    return () => {
      active = false;
      observer.disconnect();
      container.removeEventListener("contextmenu", handleNativeContextMenu, {
        capture: true,
      });
      eventBus.off("element.contextmenu", handleElementContextMenu);
      imported.finally(() => modeler.destroy());
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsideClick = () => setContextMenu(null);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [contextMenu]);

  function closeActorSelector(): void {
    setActorSelector(null);
  }

  function openActorSelector(actorId: string): void {
    const type: ActorType = "orgunit";
    setActorSelector({
      actorId,
      type,
      selection: ACTOR_COLLECTIONS[type][0],
    });
    setContextMenu(null);
  }

  function createActorForm(actorId: string, actorLabel: string): void {
    setContextMenu(null);
    onOpenActorForm?.(actorId, actorLabel);
  }

  function confirmActorSelection(): void {
    const modeler = modelerRef.current;
    if (!modeler || !actorSelector) return;

    const modeling = modeler.get<any>("modeling");
    const elementRegistry = modeler.get<any>("elementRegistry");
    const element = elementRegistry.get(actorSelector.actorId);
    if (element) {
      modeling.updateProperties(element, {
        name: actorSelector.selection,
        actorType: actorSelector.type,
        actorSelection: actorSelector.selection,
      });
    }
    setActorSelector(null);
  }

  function handleActorTypeChange(type: ActorType): void {
    setActorSelector((current) => {
      if (!current) return null;
      return {
        ...current,
        type,
        selection: ACTOR_COLLECTIONS[type][0],
      };
    });
  }

  function handleActorSelectionChange(selection: string): void {
    setActorSelector((current) => (current ? { ...current, selection } : null));
  }

  // Export the current diagram as a BPMN 2.0 XML file (.bpmn).
  async function handleExportXml(): Promise<void> {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      // `saveXML` can report a serialization failure either by rejecting or by
      // resolving with an `error` field, so check both.
      const { xml, error } = await modeler.saveXML({ format: true });
      if (error) throw error;
      if (xml) downloadFile("diagram.bpmn", xml, "application/bpmn20-xml");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleExportSvg(): Promise<void> {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      const { svg } = await modeler.saveSVG();
      downloadFile("diagram.svg", svg, "image/svg+xml");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleDownloadAllDetails(): Promise<void> {
    const modeler = modelerRef.current;
    if (!modeler) return;

    try {
      const { xml, error } = await modeler.saveXML({ format: true });
      if (error) throw error;

      const elementRegistry = modeler.get<any>("elementRegistry");
      const actors = elementRegistry
        .getAll()
        .filter(isActorElement)
        .map((element: any) => {
          const actorId = element.businessObject?.id || element.id;
          const actorType =
            element.businessObject?.actorType ||
            element.businessObject?.$type ||
            element.type;
          const actorLabel = getActorLabel(element);

          return {
            id: actorId,
            type: actorType,
            label: actorLabel,
            form: savedActorForms?.[actorId]?.schema ?? null,
            formSaved: Boolean(savedActorForms?.[actorId]),
          };
        });

      const details = {
        bpmnXml: xml,
        actors,
      };

      downloadFile(
        "all-details.json",
        JSON.stringify(details, null, 2),
        "application/json",
      );
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleNew(): Promise<void> {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      await modeler.importXML(INITIAL_DIAGRAM);
      modeler.get<Canvas>("canvas").zoom("fit-viewport");
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  // Load a .bpmn file the user picks from disk into the modeler.
  async function handleOpenFile(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const modeler = modelerRef.current;
    const file = event.target.files?.[0];
    if (!modeler || !file) return;
    try {
      const xml = await file.text();
      await modeler.importXML(xml);
      modeler.get<Canvas>("canvas").zoom("fit-viewport");
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      // Reset so picking the same file again still fires onChange.
      event.target.value = "";
    }
  }

  return (
    <div className="bpmn-editor">
      <div className="bpmn-toolbar">
        <button type="button" onClick={handleNew}>
          New
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Open…
        </button>
        <span className="bpmn-toolbar-spacer" />
        <button type="button" onClick={handleDownloadAllDetails}>
          Download all details
        </button>
        <button type="button" onClick={handleExportXml}>
          Download BPMN 2.0
        </button>
        <button type="button" onClick={handleExportSvg}>
          Download SVG
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".bpmn,.xml,application/xml,text/xml"
          onChange={handleOpenFile}
          hidden
        />
      </div>

      <div className="bpmn-body">
        <div ref={containerRef} className="bpmn-canvas" />
        <div ref={propertiesRef} className="bpmn-properties" />
      </div>

      {contextMenu && (
        <div
          className="actor-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() =>
              createActorForm(contextMenu.actorId, contextMenu.actorLabel)
            }
          >
            {savedActorForms?.[contextMenu.actorId]
              ? "Update form"
              : "Add form"}
          </button>
          <button
            type="button"
            onClick={() => openActorSelector(contextMenu.actorId)}
          >
            Select actor
          </button>
        </div>
      )}

      {actorSelector && (
        <div className="actor-popup-backdrop" onClick={closeActorSelector}>
          <div
            className="actor-popup-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Select actor type</h2>
            <div className="actor-popup-field">
              <label htmlFor="actor-type">Type</label>
              <select
                id="actor-type"
                value={actorSelector.type}
                onChange={(event) =>
                  handleActorTypeChange(event.target.value as ActorType)
                }
              >
                {ACTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="actor-popup-field">
              <label htmlFor="actor-selection">Selection</label>
              <select
                id="actor-selection"
                value={actorSelector.selection}
                onChange={(event) =>
                  handleActorSelectionChange(event.target.value)
                }
              >
                {ACTOR_COLLECTIONS[actorSelector.type].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="actor-popup-field">
              <button type="button" onClick={confirmActorSelection}>
                Save actor type
              </button>
              <button type="button" onClick={closeActorSelector}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bpmn-error">Failed to render diagram: {error}</div>
      )}
    </div>
  );
}
