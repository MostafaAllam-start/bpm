import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor";
import { is } from "bpmn-js/lib/util/ModelUtil";
import type { ModuleDeclaration } from "didi";

// Mirrors a conditional sequence flow's condition expression onto the arrow as a
// visible label node. bpmn-js keeps the condition (`bpmn:conditionExpression`)
// separate from the flow's rendered label (its `name`), so a condition set in
// the properties panel is otherwise invisible on the diagram. Whenever the
// condition changes we update the flow's label to match — which creates/moves
// the connection's label shape — so each branch shows its condition (e.g.
// `amount >= 1000`) right on the canvas.
class ConditionLabelBehavior extends CommandInterceptor {
  static $inject = ["eventBus", "modeling"];

  constructor(eventBus: any, modeling: any) {
    super(eventBus);

    // React after the property change has been applied, so the business object
    // already carries the new condition expression.
    this.postExecuted("element.updateProperties", (event: any) => {
      const { element, properties } = event.context;

      // Only conditional sequence flows, and only when the change actually
      // touched the condition (not, say, an unrelated name/id edit).
      if (!is(element, "bpmn:SequenceFlow")) return;
      if (!properties || !("conditionExpression" in properties)) return;

      const condition = element.businessObject.conditionExpression;
      const text = condition?.body ?? "";

      // Guard against re-running for an already-matching label: updateLabel
      // would otherwise push a redundant command (and our own re-entry).
      if ((element.businessObject.name ?? "") !== text) {
        modeling.updateLabel(element, text);
      }
    });
  }
}

const conditionLabelModule: ModuleDeclaration = {
  __init__: ["conditionLabelBehavior"],
  conditionLabelBehavior: ["type", ConditionLabelBehavior],
};

export default conditionLabelModule;
