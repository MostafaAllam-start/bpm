import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  MarkerType,
} from "@xyflow/react";
import type {
  Connection,
  Edge,
  IsValidConnection,
  OnSelectionChangeParams,
} from "@xyflow/react";

import i18n from "../../../i18n";
import { ELEMENT_SPECS } from "../types/index.ts";
import type {
  AllowedActor,
  BpmnEdge,
  BpmnElementType,
  BpmnNode,
  FlowDiagram,
  GlobalVariable,
} from "../types/index.ts";
import { prefixFor, uniqueId } from "../utils/ids.ts";
import { nextColorPreset } from "../utils/colors.ts";

// The default marker (closed arrowhead) on every sequence flow.
const ARROW = { type: MarkerType.ArrowClosed, width: 14, height: 14 };

// The empty starting diagram: a single start event, mirroring the old
// `buildInitialDiagram`. The start label follows the app language.
function initialNodes(): BpmnNode[] {
  return [
    {
      id: "StartEvent_1",
      type: "event",
      position: { x: 180, y: 160 },
      width: ELEMENT_SPECS.startEvent.width,
      height: ELEMENT_SPECS.startEvent.height,
      data: {
        bpmnType: "startEvent",
        name: i18n.t("diagram.start", { ns: "bpmn" }),
        props: {},
      },
    },
  ];
}

// Owns the React Flow diagram state (nodes, edges, process metadata) and the
// operations the UI drives: adding elements, connecting them, editing the
// selected element's data, and serialising to / loading from our graph model.
// The BPMN-XML conversion lives in `services/*`; this hook is the in-memory
// editing surface that replaces the old bpmn-js modeler instance.
export function useFlowModeler() {
  const [nodes, setNodes, onNodesChange] = useNodesState<BpmnNode>(initialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<BpmnEdge>([]);

  const [processMeta, setProcessMeta] = useState<{
    processId: string;
    processName: string;
    isExecutable: boolean;
    processProps: Record<string, string>;
    processVariables: GlobalVariable[];
    allowedActors: AllowedActor[];
  }>({
    processId: "Process_1",
    processName: "",
    isExecutable: false,
    processProps: {},
    processVariables: [],
    allowedActors: [],
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  // Full multi-selection (for copy/paste, bulk delete, auto-layout selection).
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);

  const { fitView, screenToFlowPosition } = useReactFlow();

  // The node a connection drag started from, captured so that releasing on empty
  // canvas can append a new connected element (bpmn.io-style).
  const connectingFrom = useRef<string | null>(null);

  // Live snapshot of the graph, synced after each render so the event-handler
  // callbacks below read the latest nodes/edges without re-subscribing.
  const idsRef = useRef({ nodes, edges });
  useEffect(() => {
    idsRef.current = { nodes, edges };
  }, [nodes, edges]);
  const takenIds = useCallback(() => {
    const set = new Set<string>();
    idsRef.current.nodes.forEach((n) => set.add(n.id));
    idsRef.current.edges.forEach((e) => set.add(e.id));
    return set;
  }, []);

  // Add a sequence-flow edge (fresh id + arrowhead) from an arbitrary partial
  // connection. Shared by onConnect, connectNodes and the append flows.
  const addFlow = useCallback(
    (source: string, target: string, extra?: Partial<Connection>) => {
      const id = uniqueId("Flow_1", takenIds());
      setEdges((eds) =>
        addEdge(
          { ...extra, source, target, id, type: "sequenceFlow", markerEnd: ARROW, data: {} },
          eds,
        ),
      );
      return id;
    },
    [setEdges, takenIds],
  );

  // Whether a flow may be created between two elements. Sequence flows are
  // one-way: a node can't connect to itself, the same direction can't be drawn
  // twice, and two elements can't be linked both ways (no A→B *and* B→A).
  const canConnect = useCallback((source: string, target: string) => {
    if (source === target) return false;
    return !idsRef.current.edges.some(
      (e) =>
        (e.source === source && e.target === target) ||
        (e.source === target && e.target === source),
    );
  }, []);

  // Live validity check React Flow uses to allow/deny a drag connection (it also
  // suppresses onConnect when invalid).
  const isValidConnection = useCallback<IsValidConnection>(
    (c: Connection | Edge) => Boolean(c.source && c.target && canConnect(c.source, c.target)),
    [canConnect],
  );

  // React Flow's interactive connect (drag handle → drop on a target handle).
  const onConnect = useCallback(
    (connection: Connection) => {
      if (canConnect(connection.source, connection.target)) {
        addFlow(connection.source, connection.target, connection);
      }
    },
    [addFlow, canConnect],
  );

  // Connect two existing elements (used by the context pad's click-to-connect).
  const connectNodes = useCallback(
    (sourceId: string, targetId: string) => {
      if (canConnect(sourceId, targetId)) addFlow(sourceId, targetId);
    },
    [addFlow, canConnect],
  );

  // Remove a node and any flows touching it.
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

  // Create a node of `type` at a flow-space position (defaults to center-ish).
  const addNode = useCallback(
    (type: BpmnElementType, position?: { x: number; y: number }) => {
      const spec = ELEMENT_SPECS[type];
      const id = uniqueId(`${prefixFor(type)}_1`, takenIds());
      const node: BpmnNode = {
        id,
        type: spec.category,
        position: position ?? { x: 320, y: 200 },
        width: spec.width,
        // Tasks grow to fit their content (a wrapped title plus the assigned
        // actor's name and type): seed a base height and let React Flow measure
        // the real one. Fixed-size shapes (events, gateways) stay explicit.
        ...(spec.category === "task"
          ? { initialHeight: spec.height }
          : { height: spec.height }),
        data: { bpmnType: type, name: "", props: {} },
      };
      setNodes((nds) => nds.concat(node));
      return id;
    },
    [setNodes, takenIds],
  );

  // Drop a palette item at a screen point (used by drag-and-drop from Palette).
  const addNodeAtScreen = useCallback(
    (type: BpmnElementType, screenX: number, screenY: number) => {
      const flow = screenToFlowPosition({ x: screenX, y: screenY });
      const spec = ELEMENT_SPECS[type];
      // Center the shape on the drop point.
      return addNode(type, {
        x: flow.x - spec.width / 2,
        y: flow.y - spec.height / 2,
      });
    },
    [addNode, screenToFlowPosition],
  );

  // Append a new element of `type` to the right of `sourceId`, joined by a flow.
  // The bpmn.io context-pad "append" gesture: create + connect in one action.
  const appendNode = useCallback(
    (sourceId: string, type: BpmnElementType) => {
      const source = idsRef.current.nodes.find((n) => n.id === sourceId);
      const spec = ELEMENT_SPECS[type];
      const position = source
        ? {
            x: source.position.x + ((source.width as number) || 0) + 90,
            y:
              source.position.y +
              ((source.height as number) ||
                (source.measured?.height as number) ||
                spec.height) /
                2 -
              spec.height / 2,
          }
        : undefined;
      const newId = addNode(type, position);
      addFlow(sourceId, newId);
      return newId;
    },
    [addNode, addFlow],
  );

  // Track the source of an in-progress connection drag.
  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null }) => {
      connectingFrom.current = params.nodeId;
    },
    [],
  );

  // When a connection is released over empty canvas (not onto another element),
  // append a new task there and connect it — bpmn.io's drop-to-create flow.
  // Releasing over an existing node is left to onConnect / isValidConnection.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { toNode: unknown | null }) => {
      const from = connectingFrom.current;
      connectingFrom.current = null;
      if (!from || connectionState.toNode) return;
      const point =
        "changedTouches" in event
          ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
          : { x: event.clientX, y: event.clientY };
      const flow = screenToFlowPosition(point);
      const spec = ELEMENT_SPECS.task;
      const newId = addNode("task", {
        x: flow.x - spec.width / 2,
        y: flow.y - spec.height / 2,
      });
      addFlow(from, newId);
    },
    [screenToFlowPosition, addNode, addFlow],
  );

  // Patch one node's data (used by the properties panel and actor assignment).
  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<BpmnNode["data"]>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
    },
    [setNodes],
  );

  // Advance a node through the colour presets (context-pad colour button).
  const cycleNodeColor = useCallback(
    (nodeId: string) => {
      const node = idsRef.current.nodes.find((n) => n.id === nodeId);
      const next = nextColorPreset(node?.data.fill);
      updateNodeData(nodeId, { fill: next.fill, stroke: next.stroke });
    },
    [updateNodeData],
  );

  const updateEdgeData = useCallback(
    (edgeId: string, patch: Partial<BpmnEdge["data"]>) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data ?? {}), ...patch } }
            : e,
        ),
      );
    },
    [setEdges],
  );

  // Rename an element id, keeping edge endpoints + selection in sync.
  const renameNodeId = useCallback(
    (oldId: string, rawId: string) => {
      const newId = rawId.trim();
      if (!newId || newId === oldId) return;
      if (takenIds().has(newId)) return;
      setNodes((nds) => nds.map((n) => (n.id === oldId ? { ...n, id: newId } : n)));
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          source: e.source === oldId ? newId : e.source,
          target: e.target === oldId ? newId : e.target,
        })),
      );
      setSelectedNodeId((cur) => (cur === oldId ? newId : cur));
    },
    [setNodes, setEdges, takenIds],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes[0]?.id ?? null);
    setSelectedEdgeId(params.edges[0]?.id ?? null);
    setSelectedNodeIds(params.nodes.map((n) => n.id));
    setSelectedEdgeIds(params.edges.map((e) => e.id));
  }, []);

  // Clear the current node/edge selection. Used when focusing the process itself
  // (e.g. clicking the process title) so the properties panel falls back to the
  // process properties.
  const clearSelection = useCallback(() => {
    setNodes((nds) =>
      nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds,
    );
    setEdges((eds) =>
      eds.some((e) => e.selected) ? eds.map((e) => (e.selected ? { ...e, selected: false } : e)) : eds,
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [setNodes, setEdges]);

  // Reconnect an existing edge to a new endpoint (drag an edge end). Honours the
  // same one-way rules as a fresh connection.
  const onReconnect = useCallback(
    (oldEdge: BpmnEdge, connection: Connection) => {
      if (!canConnect(connection.source, connection.target)) return;
      setEdges((eds) => reconnectEdge(oldEdge, connection, eds));
    },
    [canConnect, setEdges],
  );

  // Apply a history snapshot back to the canvas (undo/redo).
  const applySnapshot = useCallback(
    (snap: { nodes: BpmnNode[]; edges: BpmnEdge[] }) => {
      setNodes(snap.nodes);
      setEdges(snap.edges);
    },
    [setNodes, setEdges],
  );

  // Insert a slice of graph (copy/paste, duplicate): remap ids to fresh unique
  // ones, offset positions, drop the old selection and select the new copies.
  const insertGraph = useCallback(
    (
      srcNodes: BpmnNode[],
      srcEdges: BpmnEdge[],
      offset = { x: 40, y: 40 },
    ): string[] => {
      const taken = takenIds();
      const idMap = new Map<string, string>();
      const newNodes: BpmnNode[] = srcNodes.map((n) => {
        const id = uniqueId(`${prefixFor(n.data.bpmnType)}_1`, taken);
        idMap.set(n.id, id);
        return {
          ...structuredClone(n),
          id,
          selected: true,
          position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
        };
      });
      const newEdges: BpmnEdge[] = srcEdges
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e) => ({
          ...structuredClone(e),
          id: uniqueId("Flow_1", taken),
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          markerEnd: e.markerEnd ?? ARROW,
          selected: true,
        }));

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
      setEdges((eds) => [...eds.map((e) => ({ ...e, selected: false })), ...newEdges]);
      return newNodes.map((n) => n.id);
    },
    [setNodes, setEdges, takenIds],
  );

  // Replace the whole diagram (used by New / Open / Examples / XML import).
  const loadDiagram = useCallback(
    (diagram: FlowDiagram) => {
      setNodes(diagram.nodes);
      setEdges(
        diagram.edges.map((e) => ({
          ...e,
          type: e.type ?? "sequenceFlow",
          markerEnd: e.markerEnd ?? ARROW,
        })),
      );
      setProcessMeta({
        processId: diagram.processId,
        processName: diagram.processName,
        isExecutable: diagram.isExecutable,
        processProps: diagram.processProps,
        processVariables: diagram.processVariables ?? [],
        allowedActors: diagram.allowedActors ?? [],
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      // Fit after React Flow has applied the new nodes.
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));
    },
    [setNodes, setEdges, fitView],
  );

  const newDiagram = useCallback(() => {
    loadDiagram({
      processId: "Process_1",
      processName: "",
      isExecutable: false,
      processProps: {},
      processVariables: [],
      allowedActors: [],
      nodes: initialNodes(),
      edges: [],
    });
  }, [loadDiagram]);

  // Snapshot the current editing state as our graph model (for serialisation).
  const toDiagram = useCallback(
    (): FlowDiagram => ({
      ...processMeta,
      nodes: idsRef.current.nodes,
      edges: idsRef.current.edges,
    }),
    [processMeta],
  );

  // The live nodes/edges (for history snapshots and copy/paste).
  const getSnapshot = useCallback(
    () => ({ nodes: idsRef.current.nodes, edges: idsRef.current.edges }),
    [],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    onReconnect,
    isValidConnection,
    onSelectionChange,
    clearSelection,
    addNode,
    addNodeAtScreen,
    appendNode,
    connectNodes,
    deleteNode,
    cycleNodeColor,
    updateNodeData,
    updateEdgeData,
    renameNodeId,
    loadDiagram,
    newDiagram,
    toDiagram,
    getSnapshot,
    applySnapshot,
    insertGraph,
    fitView,
    processMeta,
    setProcessMeta,
    selectedNode,
    selectedEdge,
    selectedNodeIds,
    selectedEdgeIds,
  };
}

export type FlowModeler = ReturnType<typeof useFlowModeler>;
