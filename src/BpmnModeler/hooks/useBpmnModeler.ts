import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";
// The Zeebe provider (bundled into the "properties-panel" selectable module)
// renders the sequence-flow "Condition expression" FEEL editor; its moddle
// extension must be registered or reading/writing zeebe-namespaced properties
// throws, so it stays on regardless of which modules the user selected.
import ZeebeModdle from "zeebe-bpmn-moddle/resources/zeebe.json";

import i18n from "../../i18n";
import { buildInitialDiagram } from "../constants.ts";
import { getActorLabel, isActorElement } from "../lib/actors.ts";
import { messageOf } from "../lib/file.ts";
import translateModule from "../i18n/bpmnTranslations.ts";
import { installTokenSimulationI18n } from "../i18n/tokenSimulationI18n.ts";
import { SELECTABLE_MODULES, DEFAULT_MODULE_IDS } from "../modules.ts";
import type { ContextMenuState } from "../types.ts";

// bpmn-js renders a small "powered by bpmn.io" badge into the canvas and the
// properties panel renders its own. Hide both so they don't clutter the UI.
function hidePoweredBy(): void {
  const list = document.querySelectorAll(
    ".bjs-powered-by, .fjs-powered-by-link",
  );
  list.forEach((element) => {
    if (element instanceof HTMLElement) {
      element.style.display = "none";
    }
  });
}

// Owns the bpmn-js modeler instance and its lifecycle: creating the modeler,
// importing the initial diagram, wiring up the actor right-click detection, and
// tearing everything down on unmount. Exposes the refs the UI binds to plus the
// `error` / `contextMenu` state the surrounding component renders.
export function useBpmnModeler() {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Which optional add-ons are active. Changing this rebuilds the modeler (see
  // the effect's dependency below) with the new `additionalModules` set.
  const [selectedModuleIds, setSelectedModuleIds] =
    useState<string[]>(DEFAULT_MODULE_IDS);

  function toggleModule(id: string): void {
    setSelectedModuleIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // The latest diagram XML, kept fresh on every edit so a module-toggle rebuild
  // can re-import the user's work instead of resetting to the initial diagram.
  // Seeded with the initial diagram, its start label in the current language.
  const latestXmlRef = useRef<string>(
    buildInitialDiagram(i18n.t("diagram.start", { ns: "bpmn" })),
  );

  // A stable, order-independent key for the selection so the effect only tears
  // down and rebuilds the modeler when the *set* of modules actually changes.
  const moduleKey = [...selectedModuleIds].sort().join("|");

  useEffect(() => {
    const container = containerRef.current!;

    // Resolve the selected ids to their diagram-js modules, preserving the
    // catalogue order. `translate` always comes last so it overrides the core
    // service for everything registered before it.
    const selectedModules = SELECTABLE_MODULES.filter((m) =>
      selectedModuleIds.includes(m.id),
    ).flatMap((m) => m.modules);

    // Create the modeler bound to our container element.
    //  - propertiesPanel: renders the editable element-properties panel into the
    //    sidebar element on the right (only populated when the "properties-panel"
    //    module is among the selected ones).
    //  - additionalModules: the user-selected optional add-ons, followed by the
    //    always-on `translate` overrides.
    const modeler = new BpmnModeler({
      container,
      propertiesPanel: { parent: propertiesRef.current! },
      additionalModules: [
        ...selectedModules,
        // Overrides diagram-js's `translate` service so bpmn-js's own UI
        // (palette, context pad, properties panel, ...) follows the app
        // language. Registered last so it wins over the core service. (The
        // panel's list-group chrome translation rides along with the
        // "properties-panel" module, since it depends on `propertiesPanel`.)
        translateModule,
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle,
      },
    });
    modelerRef.current = modeler;

    // The token-simulation add-on hardcodes its UI strings (they don't go
    // through `translate`), so translate its DOM directly and keep it in sync.
    const removeTokenSimI18n = installTokenSimulationI18n(container);

    // React StrictMode mounts effects twice in development (mount → cleanup →
    // mount). `importXML` is async, so without this guard the first run's
    // import resolves *after* its modeler was destroyed and renders into a torn
    // down canvas — bpmn-js then throws "Cannot read properties of undefined
    // (reading 'root-0')". Track whether this run is still the live one.
    let active = true;
    let fitted = false;

    // Load the current diagram (the user's latest work, or the initial diagram
    // on first mount). `imported` resolves to whether it succeeded so later
    // steps can bail out cleanly on a parse error.
    const imported = modeler
      .importXML(latestXmlRef.current)
      .then(() => true)
      .catch((err: unknown) => {
        if (active) setError(messageOf(err));
        return false;
      });

    imported.then((ok) => {
      if (active && ok) {
        hidePoweredBy();
        // If the transaction-boundaries module is selected, render its overlays
        // now; staying "active" makes it re-draw them on every edit.
        modeler.get<any>("transactionBoundaries", false)?.show();
      }
    });

    const eventBus = modeler.get<any>("eventBus");

    // Keep the diagram snapshot fresh so a module-toggle rebuild re-imports the
    // current diagram rather than the initial one. `commandStack.changed` covers
    // edits; `import.done` covers wholesale loads (New / Open file / Examples),
    // which don't go through the command stack.
    const handleDiagramChanged = () => {
      modeler
        .saveXML({ format: false })
        .then(({ xml }) => {
          if (xml) latestXmlRef.current = xml;
        })
        .catch(() => {
          // Keep the previous good snapshot on a serialization error.
        });
    };
    eventBus.on(["commandStack.changed", "import.done"], handleDiagramChanged);
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

    // Re-translate bpmn-js's own UI when the app language changes: `i18n.changed`
    // re-renders the palette / context pad, and re-firing `elements.changed` for
    // the current selection re-renders the properties panel.
    //
    // Skip this entirely while the token simulation is running: forcing a
    // re-render there resets the simulation (and disables its play controls),
    // and the palette is hidden during simulation anyway.
    const handleLanguageChanged = () => {
      if (!active) return;
      const parent = modeler.get<Canvas>("canvas").getContainer().parentElement;
      if (parent?.classList.contains("simulation")) return;
      eventBus.fire("i18n.changed");
      const selected = modeler.get<any>("selection").get();
      if (selected.length) {
        eventBus.fire("elements.changed", { elements: selected });
      }
    };
    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      active = false;
      observer.disconnect();
      removeTokenSimI18n();
      i18n.off("languageChanged", handleLanguageChanged);
      container.removeEventListener("contextmenu", handleNativeContextMenu, {
        capture: true,
      });
      eventBus.off("element.contextmenu", handleElementContextMenu);
      eventBus.off(["commandStack.changed", "import.done"], handleDiagramChanged);
      imported.finally(() => modeler.destroy());
    };
    // Rebuild when the selected module set changes (`moduleKey` is the stable,
    // order-independent fingerprint of `selectedModuleIds`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsideClick = () => setContextMenu(null);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [contextMenu]);

  return {
    containerRef,
    propertiesRef,
    modelerRef,
    error,
    setError,
    contextMenu,
    setContextMenu,
    selectableModules: SELECTABLE_MODULES,
    selectedModuleIds,
    toggleModule,
  };
}
