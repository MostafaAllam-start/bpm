// Ambient declarations for bpmn.io add-ons that ship no TypeScript types.
// We only consume them as opaque diagram-js modules, so typing them as didi
// `ModuleDeclaration` is both accurate and assignable to `additionalModules`.
declare module 'bpmn-js-properties-panel' {
  import type { ModuleDeclaration } from 'didi'
  export const BpmnPropertiesPanelModule: ModuleDeclaration
  export const BpmnPropertiesProviderModule: ModuleDeclaration
  export const ZeebePropertiesProviderModule: ModuleDeclaration
}

declare module 'bpmn-js-token-simulation' {
  import type { ModuleDeclaration } from 'didi'
  const TokenSimulationModule: ModuleDeclaration
  export default TokenSimulationModule
}

declare module 'bpmn-js-color-picker' {
  import type { ModuleDeclaration } from 'didi'
  const BpmnColorPickerModule: ModuleDeclaration
  export default BpmnColorPickerModule
}

declare module 'camunda-transaction-boundaries' {
  import type { ModuleDeclaration } from 'didi'
  const transactionBoundariesModule: ModuleDeclaration
  export default transactionBoundariesModule
}
