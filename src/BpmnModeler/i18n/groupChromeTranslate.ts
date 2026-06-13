import type { ModuleDeclaration } from "didi";

// The bpmn-js properties panel renders list-group chrome — the "Create" button,
// its "Create new list item" tooltip, the "Toggle section" arrow, per-item
// "Delete item" / "Toggle list item" controls and the "List contains N items"
// badge — through each group's `props.translate`. The library never threads
// diagram-js's `translate` into those group definitions (a list group's props
// are just `{ id, label, component, items, add }`), so `ListGroup` falls back to
// an identity function and that chrome stays English regardless of the app
// language — even though our `translate` override (see ./bpmnTranslations) knows
// the strings.
//
// This provider runs *last* (lowest priority, after the Bpmn and Zeebe
// providers have produced the final group list) and attaches our `translate`
// service to every group object, so the chrome resolves through the same map as
// the rest of the panel.
const LOWEST_PRIORITY = 1;

class GroupChromeTranslateProvider {
  static $inject = ["propertiesPanel", "translate"];

  private readonly _translate: unknown;

  constructor(propertiesPanel: any, translate: unknown) {
    this._translate = translate;
    propertiesPanel.registerProvider(LOWEST_PRIORITY, this);
  }

  getGroups() {
    return (groups: Array<Record<string, unknown>>) => {
      groups.forEach((group) => {
        if (group && group.translate === undefined) {
          group.translate = this._translate;
        }
      });
      return groups;
    };
  }
}

const groupChromeTranslateModule: ModuleDeclaration = {
  __init__: ["groupChromeTranslateProvider"],
  groupChromeTranslateProvider: ["type", GroupChromeTranslateProvider],
};

export default groupChromeTranslateModule;
