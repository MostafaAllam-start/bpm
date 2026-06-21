// Ready-made BPMN diagrams the user can load from the toolbar's "Examples" menu.
// Each entry pairs a stable `id` (React list key) and an i18n `labelKey` (in the
// `bpmn` namespace, for the menu entry) with a complete BPMN 2.0 document —
// process + diagram interchange (DI) layout — so it renders immediately when
// imported.
//
// Element names in the XML are `{{token}}` placeholders, not literal text, so
// the on-canvas labels follow the app language: `localizeExample` swaps each
// token for `examples.nodes.<id>.<token>` at load time.

import type { FormSchema } from "../forms/types.ts";
import { EXAMPLE_FORMS } from "./exampleForms.ts";

export type DiagramExample = {
  id: string;
  labelKey: string;
  xml: string;
  // Starter forms for the example's actor elements, keyed by node id. Seeded
  // into `savedActorForms` when the example is loaded.
  forms?: Record<string, FormSchema>;
};

// Start → task → end. The smallest "real" process beyond the empty start event.
const SIMPLE_LINEAR = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_simple"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_simple" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="department" type="string" source="manual" value="Operations" />
        <ecmplus:globalVariable name="ticketNumber" type="number" source="api" apiUrl="https://jsonplaceholder.typicode.com/todos/1" apiPath="id" />
        <ecmplus:globalVariable name="priority" type="string" source="actor" value="normal" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
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

// Submit (request form) → review → exclusive gateway branching to two outcomes.
// The first user task collects the request via its form; the answers (e.g.
// `amount`) become variables the gateway condition reads downstream.
const APPROVAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_approval"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_approval" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="approvalLimit" type="number" source="manual" value="5000" />
        <ecmplus:globalVariable name="requesterName" type="string" source="api" apiUrl="https://jsonplaceholder.typicode.com/users/1" apiPath="name" />
        <ecmplus:globalVariable name="costCenter" type="string" source="actor" value="CC-100" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Review" name="{{review}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway" name="{{gateway}}" default="Flow_no">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Notify_ok" name="{{notifyOk}}">
      <bpmn:incoming>Flow_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Notify_no" name="{{notifyNo}}">
      <bpmn:incoming>Flow_no</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_ok" name="{{endOk}}">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_no" name="{{endNo}}">
      <bpmn:incoming>Flow_5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Review" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Review" targetRef="Gateway" />
    <bpmn:sequenceFlow id="Flow_yes" name="{{yes}}" sourceRef="Gateway" targetRef="Notify_ok">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">{recommendation} = 'approve' and {amount} &lt;= {approvalLimit}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_no" name="{{no}}" sourceRef="Gateway" targetRef="Notify_no" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Notify_ok" targetRef="End_ok" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Notify_no" targetRef="End_no" />
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
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
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
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="620" y="120" />
        <di:waypoint x="692" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
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
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_order"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_order" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="warehouse" type="string" source="manual" value="WH-1" />
        <ecmplus:globalVariable name="customerName" type="string" source="api" apiUrl="https://jsonplaceholder.typicode.com/users/2" apiPath="name" />
        <ecmplus:globalVariable name="shippingMethod" type="string" source="actor" value="standard" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
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

// Employee → manager → HR leave request, branching on the manager's decision.
const LEAVE_REQUEST = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_leave"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_leave" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="requestedDays" type="number" source="actor" value="3" />
        <ecmplus:globalVariable name="maxLeaveDays" type="number" source="manual" value="14" />
        <ecmplus:globalVariable name="managerName" type="string" source="api" apiUrl="https://jsonplaceholder.typicode.com/users/3" apiPath="name" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Manager_review" name="{{review}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Approved" name="{{approved}}" default="Flow_no">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Hr_record" name="{{record}}">
      <bpmn:incoming>Flow_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_ok" name="{{approvedEnd}}">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_no" name="{{rejectedEnd}}">
      <bpmn:incoming>Flow_no</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Manager_review" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Manager_review" targetRef="Approved" />
    <bpmn:sequenceFlow id="Flow_yes" name="{{yes}}" sourceRef="Approved" targetRef="Hr_record">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">{decision} = 'approve' and {requestedDays} &lt;= {maxLeaveDays}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_no" name="{{no}}" sourceRef="Approved" targetRef="End_no" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Hr_record" targetRef="End_ok" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_leave">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Manager_review_di" bpmnElement="Manager_review">
        <dc:Bounds x="240" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Approved_di" bpmnElement="Approved" isMarkerVisible="true">
        <dc:Bounds x="400" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Hr_record_di" bpmnElement="Hr_record">
        <dc:Bounds x="520" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_ok_di" bpmnElement="End_ok">
        <dc:Bounds x="692" y="282" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_no_di" bpmnElement="End_no">
        <dc:Bounds x="520" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="200" />
        <di:waypoint x="240" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="340" y="200" />
        <di:waypoint x="400" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_yes_di" bpmnElement="Flow_yes">
        <di:waypoint x="425" y="225" />
        <di:waypoint x="425" y="300" />
        <di:waypoint x="520" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_no_di" bpmnElement="Flow_no">
        <di:waypoint x="425" y="175" />
        <di:waypoint x="425" y="120" />
        <di:waypoint x="520" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="620" y="300" />
        <di:waypoint x="692" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Employee onboarding: collect documents, then set up IT and workspace in
// parallel, then run an orientation session.
const ONBOARDING = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_onboarding"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_onboarding" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="company" type="string" source="manual" value="ECM Plus" />
        <ecmplus:globalVariable name="buddyName" type="string" source="api" apiUrl="https://jsonplaceholder.org/users/1" apiPath="firstname" />
        <ecmplus:globalVariable name="startDate" type="date" source="actor" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Collect_docs" name="{{collect}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:parallelGateway id="Split">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_it</bpmn:outgoing>
      <bpmn:outgoing>Flow_desk</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="It_setup" name="{{itSetup}}">
      <bpmn:incoming>Flow_it</bpmn:incoming>
      <bpmn:outgoing>Flow_it2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Desk_setup" name="{{workspace}}">
      <bpmn:incoming>Flow_desk</bpmn:incoming>
      <bpmn:outgoing>Flow_desk2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:parallelGateway id="Join">
      <bpmn:incoming>Flow_it2</bpmn:incoming>
      <bpmn:incoming>Flow_desk2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="Orientation" name="{{orientation}}">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End" name="{{end}}">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Collect_docs" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Collect_docs" targetRef="Split" />
    <bpmn:sequenceFlow id="Flow_it" sourceRef="Split" targetRef="It_setup" />
    <bpmn:sequenceFlow id="Flow_desk" sourceRef="Split" targetRef="Desk_setup" />
    <bpmn:sequenceFlow id="Flow_it2" sourceRef="It_setup" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_desk2" sourceRef="Desk_setup" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Join" targetRef="Orientation" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Orientation" targetRef="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_onboarding">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Collect_docs_di" bpmnElement="Collect_docs">
        <dc:Bounds x="240" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Split_di" bpmnElement="Split">
        <dc:Bounds x="400" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="It_setup_di" bpmnElement="It_setup">
        <dc:Bounds x="510" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Desk_setup_di" bpmnElement="Desk_setup">
        <dc:Bounds x="510" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Join_di" bpmnElement="Join">
        <dc:Bounds x="680" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Orientation_di" bpmnElement="Orientation">
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
      <bpmndi:BPMNEdge id="Flow_it_di" bpmnElement="Flow_it">
        <di:waypoint x="425" y="175" />
        <di:waypoint x="425" y="120" />
        <di:waypoint x="510" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_desk_di" bpmnElement="Flow_desk">
        <di:waypoint x="425" y="225" />
        <di:waypoint x="425" y="300" />
        <di:waypoint x="510" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_it2_di" bpmnElement="Flow_it2">
        <di:waypoint x="610" y="120" />
        <di:waypoint x="705" y="120" />
        <di:waypoint x="705" y="175" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_desk2_di" bpmnElement="Flow_desk2">
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

// Form-builder stress test: a full application-processing workflow — screen →
// eligibility gateway → parallel background-check / document-verification →
// final-decision gateway → onboard. Its six forms together exercise every field
// type, both API-backed data sources (choice options and a display table),
// dynamic-text variable interpolation, conditional visibility/requiredness,
// grouped sections in every form, responsive column spans, and all three
// global-variable sources (api / manual / actor). The two exclusive gateways
// branch on form answers (`eligibility`, `finalDecision`). See EXAMPLE_FORMS
// ["applicant-processing"] for the forms themselves.
const APPLICANT_PROCESSING = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:ecmplus="http://ecmplus.com/schema/bpmn/1.0"
                  id="Definitions_showcase"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_showcase" name="{{title}}" isExecutable="false">
    <bpmn:extensionElements>
      <ecmplus:globalVariables>
        <ecmplus:globalVariable name="formVersion" type="string" source="manual" value="v2.1" />
        <ecmplus:globalVariable name="reviewerName" type="string" source="api" apiUrl="https://jsonplaceholder.org/users/1" apiPath="firstname" />
        <ecmplus:globalVariable name="region" type="string" source="actor" value="EMEA" />
      </ecmplus:globalVariables>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Start" name="{{start}}">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Screen" name="{{screen}}">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Eligible" name="{{eligible}}" default="Flow_elig_no">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_elig_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_elig_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="End_rejected_1" name="{{rejectedEnd}}">
      <bpmn:incoming>Flow_elig_no</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:parallelGateway id="Split">
      <bpmn:incoming>Flow_elig_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_split_bg</bpmn:outgoing>
      <bpmn:outgoing>Flow_split_vf</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="Background" name="{{background}}">
      <bpmn:incoming>Flow_split_bg</bpmn:incoming>
      <bpmn:outgoing>Flow_bg_join</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Verify" name="{{verify}}">
      <bpmn:incoming>Flow_split_vf</bpmn:incoming>
      <bpmn:outgoing>Flow_vf_join</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:parallelGateway id="Join">
      <bpmn:incoming>Flow_bg_join</bpmn:incoming>
      <bpmn:incoming>Flow_vf_join</bpmn:incoming>
      <bpmn:outgoing>Flow_join_final</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:userTask id="Final" name="{{final}}">
      <bpmn:incoming>Flow_join_final</bpmn:incoming>
      <bpmn:outgoing>Flow_final_gw</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Approved" name="{{approved}}" default="Flow_appr_no">
      <bpmn:incoming>Flow_final_gw</bpmn:incoming>
      <bpmn:outgoing>Flow_appr_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_appr_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Onboard" name="{{onboard}}">
      <bpmn:incoming>Flow_appr_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_onboard_end</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_approved" name="{{approvedEnd}}">
      <bpmn:incoming>Flow_onboard_end</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_rejected_2" name="{{rejectedEnd}}">
      <bpmn:incoming>Flow_appr_no</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start" targetRef="Screen" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Screen" targetRef="Eligible" />
    <bpmn:sequenceFlow id="Flow_elig_yes" name="{{yes}}" sourceRef="Eligible" targetRef="Split">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">{eligibility} = 'eligible'</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_elig_no" name="{{no}}" sourceRef="Eligible" targetRef="End_rejected_1" />
    <bpmn:sequenceFlow id="Flow_split_bg" sourceRef="Split" targetRef="Background" />
    <bpmn:sequenceFlow id="Flow_split_vf" sourceRef="Split" targetRef="Verify" />
    <bpmn:sequenceFlow id="Flow_bg_join" sourceRef="Background" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_vf_join" sourceRef="Verify" targetRef="Join" />
    <bpmn:sequenceFlow id="Flow_join_final" sourceRef="Join" targetRef="Final" />
    <bpmn:sequenceFlow id="Flow_final_gw" sourceRef="Final" targetRef="Approved" />
    <bpmn:sequenceFlow id="Flow_appr_yes" name="{{yes}}" sourceRef="Approved" targetRef="Onboard">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">{finalDecision} = 'approve'</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_appr_no" name="{{no}}" sourceRef="Approved" targetRef="End_rejected_2" />
    <bpmn:sequenceFlow id="Flow_onboard_end" sourceRef="Onboard" targetRef="End_approved" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_showcase">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="152" y="222" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Screen_di" bpmnElement="Screen">
        <dc:Bounds x="240" y="200" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Eligible_di" bpmnElement="Eligible" isMarkerVisible="true">
        <dc:Bounds x="400" y="215" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_rejected_1_di" bpmnElement="End_rejected_1">
        <dc:Bounds x="407" y="400" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Split_di" bpmnElement="Split">
        <dc:Bounds x="520" y="215" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Background_di" bpmnElement="Background">
        <dc:Bounds x="620" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Verify_di" bpmnElement="Verify">
        <dc:Bounds x="620" y="320" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Join_di" bpmnElement="Join">
        <dc:Bounds x="790" y="215" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Final_di" bpmnElement="Final">
        <dc:Bounds x="880" y="200" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Approved_di" bpmnElement="Approved" isMarkerVisible="true">
        <dc:Bounds x="1040" y="215" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Onboard_di" bpmnElement="Onboard">
        <dc:Bounds x="1150" y="200" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_approved_di" bpmnElement="End_approved">
        <dc:Bounds x="1320" y="222" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_rejected_2_di" bpmnElement="End_rejected_2">
        <dc:Bounds x="1047" y="400" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="240" />
        <di:waypoint x="240" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="340" y="240" />
        <di:waypoint x="400" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_elig_yes_di" bpmnElement="Flow_elig_yes">
        <di:waypoint x="450" y="240" />
        <di:waypoint x="520" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_elig_no_di" bpmnElement="Flow_elig_no">
        <di:waypoint x="425" y="265" />
        <di:waypoint x="425" y="400" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_split_bg_di" bpmnElement="Flow_split_bg">
        <di:waypoint x="545" y="215" />
        <di:waypoint x="545" y="120" />
        <di:waypoint x="620" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_split_vf_di" bpmnElement="Flow_split_vf">
        <di:waypoint x="545" y="265" />
        <di:waypoint x="545" y="360" />
        <di:waypoint x="620" y="360" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_bg_join_di" bpmnElement="Flow_bg_join">
        <di:waypoint x="720" y="120" />
        <di:waypoint x="815" y="120" />
        <di:waypoint x="815" y="215" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_vf_join_di" bpmnElement="Flow_vf_join">
        <di:waypoint x="720" y="360" />
        <di:waypoint x="815" y="360" />
        <di:waypoint x="815" y="265" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_join_final_di" bpmnElement="Flow_join_final">
        <di:waypoint x="840" y="240" />
        <di:waypoint x="880" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_final_gw_di" bpmnElement="Flow_final_gw">
        <di:waypoint x="980" y="240" />
        <di:waypoint x="1040" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_appr_yes_di" bpmnElement="Flow_appr_yes">
        <di:waypoint x="1090" y="240" />
        <di:waypoint x="1150" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_appr_no_di" bpmnElement="Flow_appr_no">
        <di:waypoint x="1065" y="265" />
        <di:waypoint x="1065" y="400" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_onboard_end_di" bpmnElement="Flow_onboard_end">
        <di:waypoint x="1250" y="240" />
        <di:waypoint x="1320" y="240" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const DIAGRAM_EXAMPLES: DiagramExample[] = [
  { id: "simple-linear", labelKey: "examples.simpleLinear", xml: SIMPLE_LINEAR, forms: EXAMPLE_FORMS["simple-linear"] },
  { id: "approval", labelKey: "examples.approval", xml: APPROVAL, forms: EXAMPLE_FORMS.approval },
  { id: "order", labelKey: "examples.order", xml: ORDER_FULFILLMENT, forms: EXAMPLE_FORMS.order },
  { id: "leave-request", labelKey: "examples.leaveRequest", xml: LEAVE_REQUEST, forms: EXAMPLE_FORMS["leave-request"] },
  { id: "onboarding", labelKey: "examples.onboarding", xml: ONBOARDING, forms: EXAMPLE_FORMS.onboarding },
  { id: "applicant-processing", labelKey: "examples.applicantProcessing", xml: APPLICANT_PROCESSING, forms: EXAMPLE_FORMS["applicant-processing"] },
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
