import { useCallback, useEffect, useRef, useState } from "react";

import { ELEMENT_SPECS } from "../types/index.ts";
import type { BpmnEdge, BpmnElementType, BpmnNode, GlobalVariable } from "../types/index.ts";
import type { SavedActorForm } from "../../types.ts";
import { isFormSchema, evaluateExpression, type FormValues } from "@FormBuilder";
import { seedVariables } from "../utils/variables.ts";

// A lightweight replacement for bpmn-js-token-simulation. It animates a token
// sweeping through the process: starting from the start event(s), each step
// advances the frontier along the outgoing sequence flows, highlighting the
// active nodes and the edges the token is travelling. It stops when the frontier
// empties (all paths reached an end) or the user pauses.
//
// The sweep also runs the process's data: it keeps a live variable store, seeded
// from the process-global variables' defaults. A task carrying a form pauses the
// token until the user fills and submits that form; the answers merge into the
// store as variables (keyed by field name). Decision gateways evaluate their
// outgoing flows' condition expressions against the store and take the matching
// branch automatically — only falling back to asking the user when no condition
// can decide. So the same `{variable}` expressions drive the simulated routing.
//
// The sweep pauses for user interaction at:
//   • Decision gateways (exclusive / event-based) with >1 outgoing flow whose
//     conditions don't resolve to a single branch — the user picks the path.
//   • Tasks — a form task waits for its form to be submitted; a plain task waits
//     until the user "completes" it.
//   • Catch events (intermediate catch) and receive tasks — the token waits
//     until the user "triggers" (catches) the incoming event/message.
// Everything else (parallel/inclusive gateways, throw/end events, the start
// event) advances automatically along every outgoing flow.

const STEP_MS = 750;

// Element types whose token must follow a single outgoing flow.
function isDecision(type: string): boolean {
  return type === "exclusiveGateway" || type === "eventBasedGateway";
}

// Catch elements wait to *receive* an event/message before releasing the token.
function isCatch(type: BpmnElementType): boolean {
  return type === "intermediateCatchEvent" || type === "receiveTask";
}

// Elements that hold the token until the user acts on them in the menu: every
// task (must be completed) and every catch event (must be triggered).
function isWaiting(type: BpmnElementType): boolean {
  return ELEMENT_SPECS[type].category === "task" || type === "intermediateCatchEvent";
}

// One outgoing branch of a waiting decision gateway.
export type ChoiceOption = { edgeId: string; targetId: string; label: string };
// A decision gateway awaiting the user's branch selection.
export type PendingChoice = {
  gatewayId: string;
  gatewayName: string;
  options: ChoiceOption[];
};
// A task or catch event holding the token until the user completes / triggers it.
export type SimWait = {
  nodeId: string;
  name: string;
  bpmnType: BpmnElementType;
  // true → catch event/message ("trigger"); false → task to complete.
  catch: boolean;
  // true → the task carries a form that must be filled before it releases.
  hasForm: boolean;
};

// One element the token has reached, in visit order — the run's step trace,
// shown as the simulation steps menu. A node revisited by a loop appears again.
export type SimStep = {
  nodeId: string;
  name: string;
  bpmnType: BpmnElementType;
  order: number;
};

type SimState = {
  isRunning: boolean;
  // True while the sweep is active but the auto-advance is paused by the user.
  paused: boolean;
  activeNodeIds: Set<string>;
  activeEdgeIds: Set<string>;
  // Decision gateways currently waiting for the user to choose a path.
  pending: PendingChoice[];
  // Tasks / catch events currently waiting for the user to release the token.
  waits: SimWait[];
  // Live process state: globals + submitted form answers, keyed by name.
  variables: Record<string, unknown>;
  // Ordered list of the elements the token has visited so far.
  trace: SimStep[];
};

const EMPTY: SimState = {
  isRunning: false,
  paused: false,
  activeNodeIds: new Set(),
  activeEdgeIds: new Set(),
  pending: [],
  waits: [],
  variables: {},
  trace: [],
};

type SimOptions = {
  savedActorForms: Record<string, SavedActorForm>;
  globals: GlobalVariable[];
};

export function useTokenSimulation(
  nodes: BpmnNode[],
  edges: BpmnEdge[],
  options: SimOptions,
) {
  const [state, setState] = useState<SimState>(EMPTY);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graphRef = useRef({ nodes, edges });
  const optionsRef = useRef(options);
  useEffect(() => {
    graphRef.current = { nodes, edges };
  }, [nodes, edges]);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const frontierRef = useRef<Set<string>>(new Set());
  // Mirrors of the pending/waiting interactions and store, read synchronously.
  const pendingRef = useRef<PendingChoice[]>([]);
  const waitsRef = useRef<SimWait[]>([]);
  const variablesRef = useRef<Record<string, unknown>>({});
  // User-initiated pause: blocks the auto-advance (and the auto-resume that
  // would otherwise fire when an interaction is resolved) until `resume`.
  const pausedRef = useRef(false);
  // The visit trace and its running order counter, mirrored for synchronous use.
  const traceRef = useRef<SimStep[]>([]);
  const orderRef = useRef(0);

  // Append the given node ids to the visit trace (in iteration order) and push
  // the new trace into state. Skips ids that don't resolve to a node.
  const pushTrace = useCallback((ids: Iterable<string>) => {
    const ns = graphRef.current.nodes;
    const added: SimStep[] = [];
    for (const id of ids) {
      const node = ns.find((n) => n.id === id);
      if (!node) continue;
      added.push({
        nodeId: id,
        name: node.data.name || "",
        bpmnType: node.data.bpmnType,
        order: orderRef.current++,
      });
    }
    if (added.length === 0) return;
    traceRef.current = [...traceRef.current, ...added];
    const trace = traceRef.current;
    setState((s) => ({ ...s, trace }));
  }, []);

  // Whether a node carries a fillable form (so its token waits for submission).
  const hasFormFor = useCallback((nodeId: string): boolean => {
    const saved = optionsRef.current.savedActorForms[nodeId];
    return Boolean(saved && isFormSchema(saved.schema));
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    frontierRef.current = new Set();
    pendingRef.current = [];
    waitsRef.current = [];
    variablesRef.current = {};
    pausedRef.current = false;
    traceRef.current = [];
    orderRef.current = 0;
    setState(EMPTY);
  }, [stop]);

  // A readable label for a branch: its name/label, else its raw condition, else
  // the target's name.
  const branchLabel = useCallback((edge: BpmnEdge): string => {
    const cond = edge.data?.name || edge.data?.conditionExpression;
    if (cond) return cond;
    const target = graphRef.current.nodes.find((n) => n.id === edge.target);
    return target?.data.name || edge.target;
  }, []);

  // Try to pick a gateway's branch from the variable store: the first outgoing
  // flow whose condition is true, else the default flow. Returns null when no
  // branch carries a condition, or none match and there's no default — in which
  // case the user is asked to choose.
  const resolveBranch = useCallback((outs: BpmnEdge[]): BpmnEdge | null => {
    const conditional = outs.filter((e) => e.data?.conditionExpression?.trim());
    if (conditional.length === 0) return null;
    for (const edge of conditional) {
      if (evaluateExpression(edge.data!.conditionExpression!, variablesRef.current)) {
        return edge;
      }
    }
    return outs.find((e) => e.data?.isDefault) ?? null;
  }, []);

  // Advance the frontier one hop. Decision gateways that can't auto-resolve,
  // tasks and catch events are held back (as `pending` / `waits`) and the sweep
  // pauses until the user resolves them.
  const step = useCallback(() => {
    const { nodes: ns, edges: es } = graphRef.current;
    const frontier = frontierRef.current;
    const nextNodes = new Set<string>();
    const travelled = new Set<string>();
    const pending: PendingChoice[] = [];
    const waits: SimWait[] = [];

    for (const nodeId of frontier) {
      const node = ns.find((n) => n.id === nodeId);
      if (!node) continue;
      const type = node.data.bpmnType;
      const outs = es.filter((e) => e.source === nodeId);

      if (isDecision(type) && outs.length > 1) {
        const chosen = resolveBranch(outs);
        if (chosen) {
          // A condition (or the default flow) decided the branch — take it.
          travelled.add(chosen.id);
          nextNodes.add(chosen.target);
        } else {
          // Ambiguous: the user must pick exactly one branch.
          pending.push({
            gatewayId: nodeId,
            gatewayName: node.data.name || nodeId,
            options: outs.map((e) => ({ edgeId: e.id, targetId: e.target, label: branchLabel(e) })),
          });
        }
      } else if (
        (isWaiting(type) || (type === "startEvent" && hasFormFor(nodeId))) &&
        outs.length > 0
      ) {
        // Hold the task / catch event until the user releases the token. A start
        // event carrying an initial form also waits, so that form is shown to the
        // initial actor first thing when the run begins.
        waits.push({
          nodeId,
          name: node.data.name || nodeId,
          bpmnType: type,
          catch: isCatch(type),
          hasForm: hasFormFor(nodeId),
        });
      } else {
        for (const e of outs) {
          travelled.add(e.id);
          nextNodes.add(e.target);
        }
      }
    }

    // Record the elements newly advanced to this tick (the held pending/wait
    // nodes were recorded when they first entered the frontier).
    pushTrace(nextNodes);

    if (pending.length > 0 || waits.length > 0) {
      // Pause and wait for the interaction(s). Keep the held elements highlighted
      // along with whatever else advanced this step.
      stop();
      const active = new Set(nextNodes);
      pending.forEach((p) => active.add(p.gatewayId));
      waits.forEach((w) => active.add(w.nodeId));
      frontierRef.current = active;
      pendingRef.current = pending;
      waitsRef.current = waits;
      setState((s) => ({
        ...s,
        isRunning: true,
        activeNodeIds: active,
        activeEdgeIds: travelled,
        pending,
        waits,
      }));
      return;
    }

    if (nextNodes.size === 0) {
      // All tokens reached a terminal element — finish on the last highlight.
      stop();
      frontierRef.current = new Set();
      setState((s) => ({
        ...s,
        isRunning: false,
        activeNodeIds: new Set(frontier),
        activeEdgeIds: new Set(),
        pending: [],
        waits: [],
      }));
      return;
    }

    frontierRef.current = nextNodes;
    setState((s) => ({
      ...s,
      isRunning: true,
      activeNodeIds: nextNodes,
      activeEdgeIds: travelled,
      pending: [],
      waits: [],
    }));
  }, [stop, branchLabel, resolveBranch, hasFormFor, pushTrace]);

  const startTimer = useCallback(() => {
    stop();
    timerRef.current = setInterval(step, STEP_MS);
  }, [stop, step]);

  // Whether the sweep is free to advance automatically: no unresolved
  // interaction and not paused by the user.
  const noneWaiting = () =>
    pendingRef.current.length === 0 && waitsRef.current.length === 0;
  const canAutoAdvance = () => !pausedRef.current && noneWaiting();

  // Pause / resume the auto-advance without discarding the run's state, so the
  // sweep continues from where it left off. Resuming only restarts the timer
  // when nothing is awaiting the user.
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    stop();
    setState((s) => ({ ...s, paused: true }));
  }, [stop]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setState((s) => ({ ...s, paused: false }));
    if (noneWaiting()) startTimer();
  }, [startTimer]);

  // Advance exactly one step (used by the steps menu while paused).
  const stepOnce = useCallback(() => step(), [step]);

  // Resolve one waiting gateway: send the token down the chosen branch, then
  // resume the sweep once every pending decision/wait is cleared.
  const chooseFlow = useCallback(
    (gatewayId: string, edgeId: string) => {
      const edge = graphRef.current.edges.find((e) => e.id === edgeId);
      const frontier = new Set(frontierRef.current);
      frontier.delete(gatewayId);
      if (edge) frontier.add(edge.target);
      frontierRef.current = frontier;

      const remaining = pendingRef.current.filter((p) => p.gatewayId !== gatewayId);
      pendingRef.current = remaining;
      if (edge) pushTrace([edge.target]);

      setState((s) => {
        const activeNodes = new Set(s.activeNodeIds);
        activeNodes.delete(gatewayId);
        const activeEdges = new Set(s.activeEdgeIds);
        if (edge) {
          activeNodes.add(edge.target);
          activeEdges.add(edge.id);
        }
        return { ...s, pending: remaining, activeNodeIds: activeNodes, activeEdgeIds: activeEdges };
      });

      if (canAutoAdvance()) startTimer();
    },
    [startTimer, pushTrace],
  );

  // Release a waiting task / catch event: advance its token along every outgoing
  // flow, optionally merging variables (a form submission) into the store first,
  // then resume the sweep once every interaction is cleared.
  const releaseWait = useCallback(
    (nodeId: string, mergeVars?: Record<string, unknown>) => {
      const outs = graphRef.current.edges.filter((e) => e.source === nodeId);
      const frontier = new Set(frontierRef.current);
      frontier.delete(nodeId);
      outs.forEach((e) => frontier.add(e.target));
      frontierRef.current = frontier;

      const remaining = waitsRef.current.filter((w) => w.nodeId !== nodeId);
      waitsRef.current = remaining;
      if (mergeVars) variablesRef.current = { ...variablesRef.current, ...mergeVars };
      pushTrace(outs.map((e) => e.target));

      setState((s) => {
        const activeNodes = new Set(s.activeNodeIds);
        activeNodes.delete(nodeId);
        const activeEdges = new Set(s.activeEdgeIds);
        outs.forEach((e) => {
          activeNodes.add(e.target);
          activeEdges.add(e.id);
        });
        return {
          ...s,
          waits: remaining,
          activeNodeIds: activeNodes,
          activeEdgeIds: activeEdges,
          variables: mergeVars ? { ...s.variables, ...mergeVars } : s.variables,
        };
      });

      if (canAutoAdvance()) startTimer();
    },
    [startTimer, pushTrace],
  );

  // A plain task / catch event: release with no data change.
  const triggerWait = useCallback((nodeId: string) => releaseWait(nodeId), [releaseWait]);
  // A form task: merge the submitted answers into the store, then release. Each
  // answer is written under both its bare field key (back-compat with existing
  // bare references) and the field's stable id — the ref the designer inserts for
  // cross-form variables — so a downstream condition or dynamic text can resolve
  // one specific form's field even when two forms reuse a key.
  const submitForm = useCallback(
    (nodeId: string, values: FormValues) => {
      const saved = optionsRef.current.savedActorForms[nodeId];
      const merged: Record<string, unknown> = { ...values };
      if (saved && isFormSchema(saved.schema)) {
        for (const page of saved.schema.pages ?? []) {
          for (const field of page.elements ?? []) {
            if (!field?.id) continue;
            if (field.name in values) merged[field.id] = values[field.name];
          }
        }
      }
      releaseWait(nodeId, merged);
    },
    [releaseWait],
  );

  // Start a run. `initialVars` are the values the user entered for the process
  // globals in the pre-run prompt; they override the declared defaults.
  const play = useCallback((initialVars?: Record<string, unknown>) => {
    const { nodes: ns, edges: es } = graphRef.current;
    const starts = ns.filter((n) => n.data.bpmnType === "startEvent").map((n) => n.id);
    const seed = starts.length
      ? starts
      : ns.filter((n) => !es.some((e) => e.target === n.id)).map((n) => n.id);
    if (seed.length === 0) return;

    const vars = { ...seedVariables(optionsRef.current.globals), ...(initialVars ?? {}) };
    frontierRef.current = new Set(seed);
    pendingRef.current = [];
    waitsRef.current = [];
    variablesRef.current = vars;
    pausedRef.current = false;
    orderRef.current = 0;
    // Seed the trace with the start element(s) the sweep begins from.
    const seedSteps: SimStep[] = seed
      .map((id) => ns.find((n) => n.id === id))
      .filter((n): n is BpmnNode => Boolean(n))
      .map((n) => ({
        nodeId: n.id,
        name: n.data.name || "",
        bpmnType: n.data.bpmnType,
        order: orderRef.current++,
      }));
    traceRef.current = seedSteps;
    setState({
      isRunning: true,
      paused: false,
      activeNodeIds: new Set(seed),
      activeEdgeIds: new Set(),
      pending: [],
      waits: [],
      variables: vars,
      trace: seedSteps,
    });
    startTimer();
  }, [startTimer]);

  const toggle = useCallback(() => {
    if (state.isRunning) {
      stop();
      pendingRef.current = [];
      waitsRef.current = [];
      pausedRef.current = false;
      setState((s) => ({ ...s, isRunning: false, paused: false, pending: [], waits: [] }));
    } else {
      play();
    }
  }, [state.isRunning, play, stop]);

  useEffect(() => stop, [stop]);

  return {
    isRunning: state.isRunning,
    paused: state.paused,
    activeNodeIds: state.activeNodeIds,
    activeEdgeIds: state.activeEdgeIds,
    pending: state.pending,
    waits: state.waits,
    variables: state.variables,
    trace: state.trace,
    chooseFlow,
    triggerWait,
    releaseWait,
    submitForm,
    play,
    pause,
    resume,
    stepOnce,
    toggle,
    reset,
  };
}
