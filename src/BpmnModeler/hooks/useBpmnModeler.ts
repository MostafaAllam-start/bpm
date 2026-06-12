import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from "bpmn-js-properties-panel";
import TokenSimulationModule from "bpmn-js-token-simulation";

import i18n from "../../i18n";
import { INITIAL_DIAGRAM } from "../constants.ts";
import { getActorLabel, isActorElement } from "../lib/actors.ts";
import { messageOf } from "../lib/file.ts";
import translateModule from "../i18n/bpmnTranslations.ts";
import { installTokenSimulationI18n } from "../i18n/tokenSimulationI18n.ts";
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
        // Overrides diagram-js's `translate` service so bpmn-js's own UI
        // (palette, context pad, properties panel, ...) follows the app
        // language.
        translateModule,
      ],
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
      imported.finally(() => modeler.destroy());
    };
  }, []);

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
  };
}
