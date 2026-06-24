import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ConnectionMode,
  useReactFlow,
} from "@xyflow/react";
import type { DragEvent } from "react";
import type { Edge } from "@xyflow/react";

import ActorSelectorModal from "../components/ActorSelectorModal.tsx";
import ErrorBanner from "../components/ErrorBanner.tsx";
import { DIAGRAM_EXAMPLES } from "../examples.ts";
import type { BpmnEditorProps } from "../types.ts";

import { FlowActionsContext } from "./FlowActionsContext.ts";
import type { FlowActions } from "./FlowActionsContext.ts";
import { EdgeActionsContext } from "./EdgeActionsContext.ts";
import type { EdgeActions } from "./EdgeActionsContext.ts";
import { EdgeRoutingContext, buildObstacleMap } from "./EdgeRoutingContext.ts";
import Toaster from "./components/Toaster";
import FlowToolbar from "./components/FlowToolbar.tsx";
import Palette, { PALETTE_DND_TYPE } from "./components/Palette.tsx";
import PropertiesPanel from "./components/PropertiesPanel.tsx";
import ValidationPanel from "./components/ValidationPanel.tsx";
import SimulationPanel from "./components/SimulationPanel.tsx";
import SimulationStepsPanel from "./components/SimulationStepsPanel.tsx";
import ContextMenu from "./components/ContextMenu.tsx";
import type { ContextMenuState, MenuItem } from "./components/ContextMenu.tsx";
import ProcessTitle from "./components/ProcessTitle.tsx";
import SimulationFormModal from "./components/SimulationFormModal.tsx";
import SimulationVariablesPrompt from "./components/SimulationVariablesPrompt.tsx";
import type { FormValues } from "@FormBuilder";
import { edgeTypes } from "./edges/edgeTypes.ts";
import { nodeTypes } from "./nodes/nodeTypes.ts";
import { ELEMENT_SPECS } from "./types/index.ts";
import { localizedValue } from "./utils/localizedText.ts";
import type { BpmnElementType, BpmnNode } from "./types/index.ts";
import { useFlowActorSelector } from "./hooks/useFlowActorSelector.ts";
import { useFlowDiagramActions } from "./hooks/useFlowDiagramActions.ts";
import { useFlowModeler } from "./hooks/useFlowModeler.ts";
import { useTokenSimulation } from "./hooks/useTokenSimulation.ts";
import { useHistory } from "./hooks/useHistory.ts";
import { useClipboard } from "./hooks/useClipboard.ts";
import { useValidation } from "./hooks/useValidation.ts";
import { useWorkflowShortcuts } from "./hooks/useWorkflowShortcuts.ts";
import { useClipboardStore } from "./store/clipboardStore.ts";
import { useEdgeMenuStore } from "./store/edgeMenuStore.ts";

// The React Flow workflow designer. Hosts the canvas plus the palette, property
// panel, validation panel and the cross-cutting editor behaviours (undo/redo,
// clipboard, shortcuts, right-click menus). Must render inside a
// <ReactFlowProvider> (see BpmnModeler).
export default function FlowCanvas({
  savedActorForms,
  onOpenActorForm,
  onLoadExampleForms,
}: BpmnEditorProps) {
  const modeler = useFlowModeler();
  const { i18n } = useTranslation("bpmn");
  const { screenToFlowPosition } = useReactFlow();
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // Clicking an edge reveals a trash button near the click point (deletes the
  // edge). The click position is stashed (flow coords) for the matching edge to
  // render; `below` flips the button under the line when the click is near the
  // canvas top so it never spills off-screen.
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const rect = flowWrapperRef.current?.getBoundingClientRect();
      const below = rect ? event.clientY - rect.top < 48 : false;
      const pt = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      useEdgeMenuStore.getState().setTrash({ edgeId: edge.id, x: pt.x, y: pt.y, below });
    },
    [screenToFlowPosition],
  );

  // Cross-cutting editor behaviours.
  const history = useHistory(modeler);
  const clipboard = useClipboard(modeler);
  useValidation(modeler.nodes, modeler.edges, modeler.processMeta.processVariables);
  useWorkflowShortcuts({
    undo: history.undo,
    redo: history.redo,
    copy: clipboard.copy,
    paste: clipboard.paste,
    duplicate: clipboard.duplicate,
  });

  // Actions the node context pad calls (append / delete / colour). Connecting is
  // done by dragging (from a node's border strips or its connect-arrow nub).
  const { appendNode, deleteNode, updateNodeData } = modeler;
  const padActions = useMemo<FlowActions>(
    () => ({
      append: appendNode,
      remove: deleteNode,
      setColor: (id, fill, stroke) => updateNodeData(id, { fill, stroke }),
    }),
    [appendNode, deleteNode, updateNodeData],
  );

  // Actions the per-edge UI calls: delete, persist a hand-dragged route, or reset
  // it to automatic routing.
  const { deleteEdge, setEdgeWaypoints, clearEdgeWaypoints } = modeler;
  const edgeActions = useMemo<EdgeActions>(
    () => ({
      deleteEdge,
      setWaypoints: setEdgeWaypoints,
      clearWaypoints: clearEdgeWaypoints,
    }),
    [deleteEdge, setEdgeWaypoints, clearEdgeWaypoints],
  );

  // Where the process title sits until the user drags it: centred above the
  // top edge of the diagram's bounding box (flow coordinates).
  const defaultTitlePos = useMemo(() => {
    const ns = modeler.nodes;
    if (ns.length === 0) return { x: 80, y: 40 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    for (const n of ns) {
      const w = (n.width as number) || 0;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
    }
    return { x: Math.round((minX + maxX) / 2 - 100), y: Math.round(minY - 70) };
  }, [modeler.nodes]);

  // Persist a dragged title position into the process props (flow coordinates).
  const { setProcessMeta } = modeler;
  const moveTitle = useCallback(
    (x: number, y: number) => {
      setProcessMeta((meta) => ({
        ...meta,
        processProps: { ...meta.processProps, titleX: String(x), titleY: String(y) },
      }));
    },
    [setProcessMeta],
  );

  const sim = useTokenSimulation(modeler.nodes, modeler.edges, {
    savedActorForms: savedActorForms ?? {},
    globals: modeler.processMeta.processVariables,
  });

  // The form task whose form is shown during simulation, derived (no effects)
  // from the current waits: a form pops open automatically as the token reaches
  // it, an explicitly opened one wins while it's still pending, and dismissed
  // (cancelled) forms stay closed until reopened from the simulation menu.
  // Submitting clears the wait, so the next form — if any — takes its place.
  const [requestedForm, setRequestedForm] = useState<string | null>(null);
  const [dismissedForms, setDismissedForms] = useState<ReadonlySet<string>>(new Set());
  const formNodeId = useMemo(() => {
    if (requestedForm && sim.waits.some((w) => w.nodeId === requestedForm && w.hasForm)) {
      return requestedForm;
    }
    return sim.waits.find((w) => w.hasForm && !dismissedForms.has(w.nodeId))?.nodeId ?? null;
  }, [sim.waits, dismissedForms, requestedForm]);

  const openSimForm = useCallback((nodeId: string) => {
    setRequestedForm(nodeId);
    setDismissedForms((prev) => {
      if (!prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);
  const cancelSimForm = useCallback(() => {
    if (!formNodeId) return;
    setRequestedForm((cur) => (cur === formNodeId ? null : cur));
    setDismissedForms((prev) => new Set(prev).add(formNodeId));
  }, [formNodeId]);
  const submitSimForm = useCallback(
    (nodeId: string, values: FormValues) => {
      setRequestedForm((cur) => (cur === nodeId ? null : cur));
      sim.submitForm(nodeId, values);
    },
    [sim],
  );
  // Process globals that need a value supplied at creation — "actor" variables
  // (the initial actor enters them) and "api" variables (fetched then). "manual"
  // variables are fixed at design time, so they're seeded directly and never
  // prompted. When any of these exist, a run pauses on a prompt first.
  const namedGlobals = useMemo(
    () =>
      modeler.processMeta.processVariables.filter(
        (v) => v.name.trim() && (v.source ?? "manual") !== "manual",
      ),
    [modeler.processMeta.processVariables],
  );
  const [varPromptOpen, setVarPromptOpen] = useState(false);
  // Whether the simulation session is open. Kept separate from the sweep's
  // `isRunning`: when the token reaches the end, the sweep stops but the session
  // stays open (steps menu still shown) until the user explicitly stops it.
  const [simActive, setSimActive] = useState(false);

  // Begin a run: collect global-variable values first when the process declares
  // any, otherwise start the sweep immediately. Also used to re-run after a run
  // has ended.
  const startSim = useCallback(() => {
    setRequestedForm(null);
    setDismissedForms(new Set());
    setSimActive(true);
    if (namedGlobals.length > 0) setVarPromptOpen(true);
    else sim.play();
  }, [sim, namedGlobals]);

  // End the session entirely: clear the sweep and return to edit mode.
  const stopSim = useCallback(() => {
    setVarPromptOpen(false);
    setRequestedForm(null);
    setDismissedForms(new Set());
    sim.reset();
    setSimActive(false);
  }, [sim]);

  // The toolbar / steps-menu toggle: start when idle, stop when a session is
  // open (running, paused, or already ended).
  const toggleSimulation = useCallback(() => {
    if (simActive) stopSim();
    else startSim();
  }, [simActive, startSim, stopSim]);

  const startSimWithVariables = useCallback(
    (values: Record<string, unknown>) => {
      setVarPromptOpen(false);
      sim.play(values);
    },
    [sim],
  );
  // Cancelling the pre-run prompt aborts the session (the sweep never started).
  const cancelVarPrompt = useCallback(() => {
    setVarPromptOpen(false);
    setSimActive(false);
  }, []);

  const actions = useFlowDiagramActions({ modeler, savedActorForms, setError, flowWrapperRef });

  const {
    actorSelector,
    actorVariables,
    openActorSelector,
    closeActorSelector,
    createActorForm,
    confirmActorSelection,
    canSave,
    controls,
  } = useFlowActorSelector({
    modeler,
    onOpenActorForm,
    savedActorForms: savedActorForms ?? {},
    onCloseMenu: closeMenu,
  });

  // The process's start event — the carrier of the initial actor + form, edited
  // either by right-clicking it or from the process properties panel.
  const startNode = useMemo(
    () => modeler.nodes.find((n) => n.data.bpmnType === "startEvent") ?? null,
    [modeler.nodes],
  );

  // Right-click a node → context menu (actor actions for tasks, then edit ops).
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: BpmnNode) => {
      event.preventDefault();
      const spec = ELEMENT_SPECS[node.data.bpmnType];
      const items: MenuItem[] = [];
      if (spec.actor) {
        const label = node.data.props.actorName || node.data.name || node.id;
        // The start event carries only an optional *initial form* (no actor
        // assignment); other actor elements get the full actor + form pair.
        const isStart = node.data.bpmnType === "startEvent";
        const hasForm = Boolean(savedActorForms?.[node.id]);
        if (!isStart) {
          items.push({
            labelKey: "contextMenu.selectActor",
            icon: "actor",
            onClick: () => openActorSelector(node.id),
          });
        }
        items.push(
          {
            labelKey: isStart
              ? hasForm ? "contextMenu.updateInitialForm" : "contextMenu.addInitialForm"
              : hasForm ? "contextMenu.updateForm" : "contextMenu.addForm",
            icon: "form",
            onClick: () => createActorForm(node.id, label),
          },
          "separator",
        );
      }
      items.push(
        { labelKey: "menu.duplicate", icon: "duplicate", onClick: () => modeler.insertGraph([node], []) },
        { labelKey: "menu.copy", icon: "copy", onClick: () => useClipboardStore.getState().copy([node], []) },
        { labelKey: "menu.delete", icon: "delete", danger: true, onClick: () => modeler.deleteNode(node.id) },
      );
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [modeler, savedActorForms, openActorSelector, createActorForm],
  );

  // Right-click empty canvas → paste / layout / fit.
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setMenu({
        x: (event as MouseEvent).clientX,
        y: (event as MouseEvent).clientY,
        items: [
          { labelKey: "menu.paste", icon: "paste", disabled: !useClipboardStore.getState().hasContent(), onClick: clipboard.paste },
          { labelKey: "menu.autoLayout", icon: "layout", onClick: actions.handleAutoLayout },
          { labelKey: "menu.fitView", icon: "fit", onClick: () => modeler.fitView({ padding: 0.2, duration: 250 }) },
        ],
      });
    },
    [clipboard, actions, modeler],
  );

  // Palette drag-and-drop onto the canvas.
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(PALETTE_DND_TYPE) as BpmnElementType;
      if (type && ELEMENT_SPECS[type]) modeler.addNodeAtScreen(type, event.clientX, event.clientY);
    },
    [modeler],
  );

  // The endpoints of any currently-selected edge — highlighted so the user can
  // see which two elements the selected flow connects.
  const edgeEndpointIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of modeler.edges) {
      if (e.selected) {
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    return ids;
  }, [modeler.edges]);

  // Overlay the simulation highlight + selected-edge endpoint glow onto the nodes.
  const renderedNodes = useMemo(
    () =>
      modeler.nodes.map((n) => {
        const className =
          [
            sim.activeNodeIds.has(n.id) ? "bf-node-active" : "",
            edgeEndpointIds.has(n.id) ? "bf-node-edge-endpoint" : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined;
        return className ? { ...n, className } : n;
      }),
    [modeler.nodes, sim.activeNodeIds, edgeEndpointIds],
  );
  const renderedEdges = useMemo(
    () =>
      modeler.edges.map((e) =>
        sim.activeEdgeIds.has(e.id) ? { ...e, animated: true } : { ...e, animated: false },
      ),
    [modeler.edges, sim.activeEdgeIds],
  );

  // Shared input for obstacle-aware edge routing (see EdgeRoutingContext).
  // Recomputed only when nodes change; `dragging` lets edges skip routing while
  // a node is mid-drag and re-route once it settles.
  const obstacles = useMemo(() => buildObstacleMap(modeler.nodes), [modeler.nodes]);
  const anyDragging = useMemo(() => modeler.nodes.some((n) => n.dragging), [modeler.nodes]);
  const edgeRouting = useMemo(
    () => ({ obstacles, dragging: anyDragging }),
    [obstacles, anyDragging],
  );

  // After replacing the whole graph, re-seed the undo history baseline.
  const reload = useCallback(
    (fn: () => void) => {
      sim.reset();
      setSimActive(false);
      setRequestedForm(null);
      setDismissedForms(new Set());
      setVarPromptOpen(false);
      fn();
      requestAnimationFrame(history.rebase);
    },
    [sim, history],
  );

  return (
    <FlowActionsContext.Provider value={padActions}>
      <EdgeActionsContext.Provider value={edgeActions}>
      <EdgeRoutingContext.Provider value={edgeRouting}>
      <div className="bpmn-editor">
        <FlowToolbar
          fileInputRef={actions.fileInputRef}
          jsonInputRef={actions.jsonInputRef}
          onNew={() => reload(actions.handleNew)}
          onOpenFile={(e) => reload(() => actions.handleOpenFile(e))}
          onOpenJson={(e) => reload(() => actions.handleOpenJson(e))}
          onSaveJson={actions.handleSaveJson}
          onDownloadAllDetails={actions.handleDownloadAllDetails}
          onExportXml={actions.handleExportXml}
          onExportSvg={actions.handleExportSvg}
          onAutoLayout={actions.handleAutoLayout}
          examples={DIAGRAM_EXAMPLES}
          onLoadExample={(xml, forms) =>
            reload(() => {
              actions.handleLoadExample(xml);
              onLoadExampleForms?.(forms);
            })
          }
          simulating={simActive}
          onToggleSimulation={toggleSimulation}
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />

        <div className="bpmn-body" dir="ltr">
          <Palette onAdd={modeler.addNode} />

          <div className="bf-canvas" ref={flowWrapperRef}>
            <ReactFlow
              nodes={renderedNodes}
              edges={renderedEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={modeler.onNodesChange}
              onEdgesChange={modeler.onEdgesChange}
              onConnect={modeler.onConnect}
              onConnectStart={modeler.onConnectStart}
              onConnectEnd={modeler.onConnectEnd}
              onReconnect={modeler.onReconnect}
              isValidConnection={modeler.isValidConnection}
              onSelectionChange={modeler.onSelectionChange}
              onEdgeClick={onEdgeClick}
              onNodeContextMenu={onNodeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              onDrop={onDrop}
              onDragOver={onDragOver}
              connectionMode={ConnectionMode.Loose}
              deleteKeyCode={["Backspace", "Delete"]}
              multiSelectionKeyCode={["Meta", "Control", "Shift"]}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} color="var(--border-strong)" />
              {(() => {
                const title = localizedValue(
                  modeler.processMeta.processName,
                  modeler.processMeta.processProps.nameAr,
                  i18n.language,
                );
                return title ? (
                  <ProcessTitle
                    text={title}
                    props={modeler.processMeta.processProps}
                    defaultPosition={defaultTitlePos}
                    onMove={moveTitle}
                    onSelect={modeler.clearSelection}
                  />
                ) : null;
              })()}
              <Controls />
              <MiniMap pannable zoomable />
              <ValidationPanel />
              <SimulationPanel
                pending={sim.pending}
                waits={sim.waits}
                onChoose={sim.chooseFlow}
                onTrigger={sim.triggerWait}
                onOpenForm={openSimForm}
              />
            </ReactFlow>
          </div>

          {simActive ? (
            <SimulationStepsPanel
              trace={sim.trace}
              activeNodeIds={sim.activeNodeIds}
              nodes={modeler.nodes}
              edges={modeler.edges}
              savedActorForms={savedActorForms ?? {}}
              globals={modeler.processMeta.processVariables}
              variables={sim.variables}
              running={sim.isRunning}
              paused={sim.paused}
              waiting={sim.pending.length > 0 || sim.waits.length > 0}
              onPause={sim.pause}
              onResume={sim.resume}
              onStep={sim.stepOnce}
              onRestart={startSim}
              onStop={toggleSimulation}
            />
          ) : (
            <PropertiesPanel
              modeler={modeler}
              savedActorForms={savedActorForms ?? {}}
              onEditInitialForm={
                startNode
                  ? () => createActorForm(startNode.id, startNode.data.name || startNode.id)
                  : undefined
              }
            />
          )}
        </div>

        {menu && <ContextMenu menu={menu} onClose={closeMenu} />}

        {varPromptOpen && (
          <SimulationVariablesPrompt
            variables={namedGlobals}
            onStart={startSimWithVariables}
            onCancel={cancelVarPrompt}
          />
        )}

        {formNodeId && savedActorForms?.[formNodeId] && (
          <SimulationFormModal
            nodeId={formNodeId}
            saved={savedActorForms[formNodeId]}
            variables={sim.variables}
            onSubmit={submitSimForm}
            onCancel={cancelSimForm}
          />
        )}

        {actorSelector && (
          <ActorSelectorModal
            actorSelector={actorSelector}
            controls={controls}
            availableVariables={actorVariables}
            canSave={canSave}
            onClose={closeActorSelector}
            onConfirm={confirmActorSelection}
          />
        )}

        {error && <ErrorBanner message={error} />}
        <Toaster />
      </div>
      </EdgeRoutingContext.Provider>
      </EdgeActionsContext.Provider>
    </FlowActionsContext.Provider>
  );
}
