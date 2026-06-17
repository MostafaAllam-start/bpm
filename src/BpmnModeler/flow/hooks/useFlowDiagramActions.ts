import { useRef } from "react";
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import { toSvg } from "html-to-image";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { FlowDiagram } from "../types/index.ts";
import { fromBpmnXml } from "../services/fromBpmnXml.ts";
import { toBpmnXml } from "../services/toBpmnXml.ts";
import { autoLayout } from "../services/autoLayout.ts";
import { downloadFile, messageOf } from "../../lib/file.ts";
import { useActorStore } from "../../store/actorStore.ts";
import { buildActorAssignment } from "../../lib/actorAssignment.ts";
import type { BpmnEditorProps } from "../../types.ts";
import type { FlowModeler } from "./useFlowModeler.ts";

// Toolbar actions for the React Flow modeler — the analogue of the old
// `useDiagramActions`. New / Open / Examples replace the whole diagram; the
// three exports serialise the current graph (XML via `toBpmnXml`, SVG via
// html-to-image over the rendered canvas, and the details JSON bundling the
// actors + declared variables).

type Params = {
  modeler: FlowModeler;
  savedActorForms: BpmnEditorProps["savedActorForms"];
  setError: Dispatch<SetStateAction<string | null>>;
  // The React Flow wrapper element, used as the SVG export source.
  flowWrapperRef: RefObject<HTMLDivElement | null>;
};

export function useFlowDiagramActions({
  modeler,
  savedActorForms,
  setError,
  flowWrapperRef,
}: Params) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  function handleNew(): void {
    modeler.newDiagram();
    setError(null);
  }

  // Re-arrange the graph with the auto-layout engine, then fit it in view.
  function handleAutoLayout(): void {
    const { nodes, edges } = modeler.getSnapshot();
    modeler.applySnapshot({ nodes: autoLayout(nodes, edges), edges });
    requestAnimationFrame(() => modeler.fitView({ padding: 0.2, duration: 250 }));
  }

  // Save the workflow as our native JSON graph (round-trips losslessly).
  function handleSaveJson(): void {
    try {
      downloadFile(
        "workflow.json",
        JSON.stringify(modeler.toDiagram(), null, 2),
        "application/json",
      );
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleOpenJson(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as FlowDiagram;
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error("Invalid workflow JSON (missing nodes/edges)");
      }
      modeler.loadDiagram(parsed);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      event.target.value = "";
    }
  }

  function handleLoadExample(xml: string): void {
    try {
      modeler.loadDiagram(fromBpmnXml(xml));
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleOpenFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      modeler.loadDiagram(fromBpmnXml(xml));
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      event.target.value = "";
    }
  }

  function handleExportXml(): void {
    try {
      const { xml } = toBpmnXml(modeler.toDiagram(), { savedActorForms });
      downloadFile("diagram.bpmn", xml, "application/bpmn20-xml");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleExportSvg(): Promise<void> {
    const wrapper = flowWrapperRef.current;
    const viewport = wrapper?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport) return;
    try {
      // Render the (transformed) viewport to SVG. Capture at the viewport's
      // current layout size; nodes outside it are still included by html-to-image.
      const dataUrl = await toSvg(viewport, {
        backgroundColor: "#ffffff",
        width: wrapper!.clientWidth,
        height: wrapper!.clientHeight,
      });
      const svg = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml,/, ""));
      downloadFile("diagram.svg", svg, "image/svg+xml");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  function handleDownloadAllDetails(): void {
    try {
      const diagram = modeler.toDiagram();
      const { xml, variables } = toBpmnXml(diagram, { savedActorForms });

      const actors = diagram.nodes
        .filter((n) => ELEMENT_SPECS[n.data.bpmnType].actor)
        .map((node) => {
          const props = node.data.props;
          const saved = useActorStore.getState().getActor(node.id);
          // Prefer the structured assignment from the store, falling back to the
          // flat props mirrored on the node.
          const built = saved ? buildActorAssignment({ actorId: node.id, ...saved }) : null;
          const p = built ? built.props : props;
          const hasAssignment = Boolean(p.actorKind);

          const selectedActorId = hasAssignment
            ? p.actorEmployeeId ?? p.actorPrimaryId ?? p.actorValue ?? null
            : null;

          return {
            id: node.id,
            type: `bpmn:${node.data.bpmnType}`,
            actorType: p.actorKind ?? null,
            selectedActorId,
            label: p.actorName || node.data.name || node.id,
            assignment: hasAssignment
              ? {
                  kind: p.actorKind,
                  name: p.actorName ?? null,
                  role: p.actorRole ?? null,
                  primaryId: p.actorPrimaryId ?? null,
                  primaryName: p.actorPrimaryName ?? null,
                  employeeId: p.actorEmployeeId ?? null,
                  employeeName: p.actorEmployeeName ?? null,
                  value: p.actorValue ?? null,
                }
              : null,
            form: savedActorForms?.[node.id]?.schema ?? null,
            formSaved: Boolean(savedActorForms?.[node.id]),
          };
        });

      const details = {
        bpmnXml: xml,
        actors,
        variables,
        globalVariables: diagram.processVariables,
      };
      downloadFile("all-details.json", JSON.stringify(details, null, 2), "application/json");
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return {
    fileInputRef,
    jsonInputRef,
    handleNew,
    handleOpenFile,
    handleLoadExample,
    handleDownloadAllDetails,
    handleExportXml,
    handleExportSvg,
    handleAutoLayout,
    handleSaveJson,
    handleOpenJson,
  };
}
