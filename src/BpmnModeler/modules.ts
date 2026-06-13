// The catalogue of optional bpmn-js add-ons the user can switch on and off from
// the toolbar's "Modules" menu. Toggling a module rebuilds the modeler with the
// new `additionalModules` set (see `useBpmnModeler`), so each entry here maps a
// stable `id` (persisted in selection state) to the diagram-js modules it
// contributes and an i18n `labelKey` in the `bpmn` namespace.
//
// Infrastructure that must always be present — the `translate` overrides and the
// Zeebe moddle — is registered directly in the hook and intentionally NOT listed
// here, so the user can't disable it and break the UI.
import type { ModuleDeclaration } from "didi";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule,
} from "bpmn-js-properties-panel";
import TokenSimulationModule from "bpmn-js-token-simulation";
import BpmnColorPickerModule from "bpmn-js-color-picker";
import transactionBoundariesModule from "camunda-transaction-boundaries";

import conditionLabelModule from "./behaviors/conditionLabel.ts";
import groupChromeTranslateModule from "./i18n/groupChromeTranslate.ts";

export type SelectableModule = {
  // Stable key stored in the selection state and used as the React list key.
  id: string;
  // i18n key (in the `bpmn` namespace) for the label shown in the menu.
  labelKey: string;
  // The diagram-js modules this entry folds into `additionalModules`.
  modules: ModuleDeclaration[];
  // Whether the module starts enabled.
  defaultEnabled: boolean;
};

export const SELECTABLE_MODULES: SelectableModule[] = [
  {
    id: "properties-panel",
    labelKey: "modules.propertiesPanel",
    // The panel plus its base + Zeebe providers travel together: the Zeebe
    // provider is what adds the sequence-flow "Condition expression" editor.
    // `groupChromeTranslate` injects the `propertiesPanel` service, so it must
    // ship with this bundle (it can't be registered when the panel is off).
    modules: [
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      ZeebePropertiesProviderModule,
      groupChromeTranslateModule,
    ],
    defaultEnabled: true,
  },
  {
    id: "token-simulation",
    labelKey: "modules.tokenSimulation",
    modules: [TokenSimulationModule],
    defaultEnabled: true,
  },
  {
    id: "color-picker",
    labelKey: "modules.colorPicker",
    modules: [BpmnColorPickerModule],
    defaultEnabled: true,
  },
  {
    id: "condition-label",
    labelKey: "modules.conditionLabel",
    modules: [conditionLabelModule],
    defaultEnabled: true,
  },
  {
    id: "transaction-boundaries",
    labelKey: "modules.transactionBoundaries",
    modules: [transactionBoundariesModule],
    defaultEnabled: true,
  },
];

// The ids enabled on first load.
export const DEFAULT_MODULE_IDS: string[] = SELECTABLE_MODULES.filter(
  (m) => m.defaultEnabled,
).map((m) => m.id);
