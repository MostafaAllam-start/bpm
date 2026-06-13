import { useRef } from "react";
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import type BpmnModeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";

import i18n from "../../i18n";
import { buildInitialDiagram } from "../constants.ts";
import { getActorLabel, isActorElement } from "../lib/actors.ts";
import { buildActorAssignment } from "../lib/actorAssignment.ts";
import type { ActorProps } from "../lib/actorAssignment.ts";
import { downloadFile, messageOf } from "../lib/file.ts";
import { useActorStore } from "../store/actorStore.ts";
import type { BpmnEditorProps } from "../types.ts";

// Resolve an actor's saved props for export. The actor store is the source of
// truth (its selection round-trips with resolved labels); we fall back to any
// values mirrored onto the BPMN element for actors assigned before the store.
function actorPropsFor(
  actorId: string,
  businessObject: any,
): ActorProps | null {
  const saved = useActorStore.getState().getActor(actorId);
  if (saved) {
    const built = buildActorAssignment({ actorId, ...saved });
    if (built) return built.props;
  }
  if (!businessObject?.actorKind) return null;
  const props: ActorProps = { actorKind: businessObject.actorKind };
  const carry = (key: keyof ActorProps, value: unknown) => {
    if (value !== undefined && value !== null) props[key] = String(value);
  };
  carry("actorRole", businessObject.actorRole);
  carry("actorPrimaryId", businessObject.actorPrimaryId);
  carry("actorPrimaryName", businessObject.actorPrimaryName);
  carry("actorEmployeeId", businessObject.actorEmployeeId);
  carry("actorEmployeeName", businessObject.actorEmployeeName);
  carry("actorValue", businessObject.actorValue);
  carry("actorName", businessObject.actorName);
  return props;
}

type UseDiagramActionsParams = {
  modelerRef: RefObject<BpmnModeler | null>;
  savedActorForms: BpmnEditorProps["savedActorForms"];
  setError: Dispatch<SetStateAction<string | null>>;
};

// Toolbar actions that read from / write to the diagram: new, open, and the
// three export flows. Returns the hidden file-input ref the toolbar drives plus
// the handlers, keeping all modeler interaction out of the UI components.
export function useDiagramActions({
  modelerRef,
  savedActorForms,
  setError,
}: UseDiagramActionsParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          const businessObject = element.businessObject;
          const actorId = businessObject?.id || element.id;

          // Pull the assigned actor's data from the store (falling back to the
          // element), then derive the export fields from it.
          const props = actorPropsFor(actorId, businessObject);

          // The id of the actually-selected actor entity: the leaf selection
          // (employee/manager) when there is one, else the primary entity, else
          // the free-text value for "custom" actors. Null when unassigned.
          const selectedActorId = props
            ? props.actorEmployeeId ??
              props.actorPrimaryId ??
              props.actorValue ??
              null
            : null;

          // The cascading selector stores its choice as flat custom props; gather
          // them back into a structured assignment when present.
          const assignment = props
            ? {
                kind: props.actorKind,
                name: props.actorName ?? null,
                role: props.actorRole ?? null,
                primaryId: props.actorPrimaryId ?? null,
                primaryName: props.actorPrimaryName ?? null,
                employeeId: props.actorEmployeeId ?? null,
                employeeName: props.actorEmployeeName ?? null,
                // Free-text value for "custom" actors (no backing id).
                value: props.actorValue ?? null,
              }
            : null;

          return {
            id: actorId,
            type: businessObject?.$type || element.type,
            actorType: props?.actorKind ?? null,
            selectedActorId,
            label: props?.actorName || getActorLabel(element),
            assignment,
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
      const startLabel = i18n.t("diagram.start", { ns: "bpmn" });
      await modeler.importXML(buildInitialDiagram(startLabel));
      modeler.get<Canvas>("canvas").zoom("fit-viewport");
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  // Replace the canvas with one of the bundled example diagrams.
  async function handleLoadExample(xml: string): Promise<void> {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      await modeler.importXML(xml);
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

  return {
    fileInputRef,
    handleNew,
    handleOpenFile,
    handleLoadExample,
    handleDownloadAllDetails,
    handleExportXml,
    handleExportSvg,
  };
}
