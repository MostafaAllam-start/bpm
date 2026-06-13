// Ready-made BPMN diagrams the user can load from the toolbar's "Examples" menu.
// Each entry pairs a stable `id` (React list key) and an i18n `labelKey` (in the
// `bpmn` namespace, for the menu entry) with a complete BPMN 2.0 document —
// process + diagram interchange (DI) layout — so it renders immediately when
// imported.
//
// Element names in the XML are `{{token}}` placeholders, not literal text, so
// the on-canvas labels follow the app language: `localizeExample` swaps each
// token for `examples.nodes.<id>.<token>` at load time.

export type DiagramExample = {
  id: string;
  labelKey: string;
  xml: string;
};

// Start → task → end. The smallest "real" process beyond the empty start event.
const SIMPLE_LINEAR = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_simple"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_simple" isExecutable="false">
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_do" name="{{task}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End" name="{{end}}">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Task_do" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_do" targetRef="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_simple">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_do_di" bpmnElement="Task_do">
        <dc:Bounds x="250" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_di" bpmnElement="End">
        <dc:Bounds x="412" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="200" />
        <di:waypoint x="250" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="200" />
        <di:waypoint x="412" y="200" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// A user task feeding an exclusive gateway that branches to two outcomes.
const APPROVAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_approval"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_approval" isExecutable="false">
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Review" name="{{review}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway" name="{{gateway}}">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Notify_ok" name="{{notifyOk}}">
      <bpmn:incoming>Flow_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Notify_no" name="{{notifyNo}}">
      <bpmn:incoming>Flow_no</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_ok" name="{{endOk}}">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_no" name="{{endNo}}">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Review" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Review" targetRef="Gateway" />
    <bpmn:sequenceFlow id="Flow_yes" name="{{yes}}" sourceRef="Gateway" targetRef="Notify_ok" />
    <bpmn:sequenceFlow id="Flow_no" name="{{no}}" sourceRef="Gateway" targetRef="Notify_no" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Notify_ok" targetRef="End_ok" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Notify_no" targetRef="End_no" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_approval">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Review_di" bpmnElement="Review">
        <dc:Bounds x="240" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_di" bpmnElement="Gateway" isMarkerVisible="true">
        <dc:Bounds x="400" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Notify_ok_di" bpmnElement="Notify_ok">
        <dc:Bounds x="520" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Notify_no_di" bpmnElement="Notify_no">
        <dc:Bounds x="520" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_ok_di" bpmnElement="End_ok">
        <dc:Bounds x="692" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_no_di" bpmnElement="End_no">
        <dc:Bounds x="692" y="282" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="200" />
        <di:waypoint x="240" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="200" />
        <di:waypoint x="400" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_yes_di" bpmnElement="Flow_yes">
        <di:waypoint x="425" y="175" />
        <di:waypoint x="425" y="120" />
        <di:waypoint x="520" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_no_di" bpmnElement="Flow_no">
        <di:waypoint x="425" y="225" />
        <di:waypoint x="425" y="300" />
        <di:waypoint x="520" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="620" y="120" />
        <di:waypoint x="692" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="620" y="300" />
        <di:waypoint x="692" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Parallel split/join: pack and pay happen concurrently, then ship.
const ORDER_FULFILLMENT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_order"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_order" isExecutable="false">
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Validate" name="{{validate}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:parallelGateway id="Split">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_pack</bpmn:outgoing>
      <bpmn:outgoing>Flow_pay</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:task id="Pack" name="{{pack}}">
      <bpmn:incoming>Flow_pack</bpmn:incoming>
      <bpmn:outgoing>Flow_pack2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Pay" name="{{pay}}">
      <bpmn:incoming>Flow_pay</bpmn:incoming>
      <bpmn:outgoing>Flow_pay2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:parallelGateway id="Join">
      <bpmn:incoming>Flow_pack2</bpmn:incoming>
      <bpmn:incoming>Flow_pay2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:task id="Ship" name="{{ship}}">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End" name="{{end}}">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Validate" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Validate" targetRef="Split" />
    <bpmn:sequenceFlow id="Flow_pack" sourceRef="Split" targetRef="Pack" />
    <bpmn:sequenceFlow id="Flow_pay" sourceRef="Split" targetRef="Pay" />
    <bpmn:sequenceFlow id="Flow_pack2" sourceRef="Pack" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_pay2" sourceRef="Pay" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Join" targetRef="Ship" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Ship" targetRef="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_order">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Validate_di" bpmnElement="Validate">
        <dc:Bounds x="240" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Split_di" bpmnElement="Split">
        <dc:Bounds x="400" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Pack_di" bpmnElement="Pack">
        <dc:Bounds x="510" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Pay_di" bpmnElement="Pay">
        <dc:Bounds x="510" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Join_di" bpmnElement="Join">
        <dc:Bounds x="680" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Ship_di" bpmnElement="Ship">
        <dc:Bounds x="790" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_di" bpmnElement="End">
        <dc:Bounds x="952" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="200" />
        <di:waypoint x="240" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="200" />
        <di:waypoint x="400" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pack_di" bpmnElement="Flow_pack">
        <di:waypoint x="425" y="175" />
        <di:waypoint x="425" y="120" />
        <di:waypoint x="510" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pay_di" bpmnElement="Flow_pay">
        <di:waypoint x="425" y="225" />
        <di:waypoint x="425" y="300" />
        <di:waypoint x="510" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pack2_di" bpmnElement="Flow_pack2">
        <di:waypoint x="610" y="120" />
        <di:waypoint x="705" y="120" />
        <di:waypoint x="705" y="175" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pay2_di" bpmnElement="Flow_pay2">
        <di:waypoint x="610" y="300" />
        <di:waypoint x="705" y="300" />
        <di:waypoint x="705" y="225" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="730" y="200" />
        <di:waypoint x="790" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="890" y="200" />
        <di:waypoint x="952" y="200" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const DIAGRAM_EXAMPLES: DiagramExample[] = [
  { id: "simple-linear", labelKey: "examples.simpleLinear", xml: SIMPLE_LINEAR },
  { id: "approval", labelKey: "examples.approval", xml: APPROVAL },
  { id: "order", labelKey: "examples.order", xml: ORDER_FULFILLMENT },
];

// Escape the few characters that aren't valid inside a double-quoted XML
// attribute, so a translated name with `&`, `<`, `>` or `"` can't break the doc.
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Swap each `{{token}}` in the example for its translated label
// (`examples.nodes.<id>.<token>`), falling back to the token itself if a key is
// missing so a typo degrades to a visible name rather than a blank node.
export function localizeExample(
  example: DiagramExample,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return example.xml.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
    const label = t(`examples.nodes.${example.id}.${token}`, {
      defaultValue: token,
    });
    return escapeXmlAttr(label);
  });
}
